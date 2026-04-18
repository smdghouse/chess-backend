//import { Chess } from "chess.js";
const { Chess } = require("chess.js")
const GameModel = require("./models/moves.js")
class Game {
    constructor(white, black, roomId, whiteid, blackid, manager, isRecovery=false) {
        this.white = white;
        this.black = black;
        this.roomId = roomId;
        this.whiteid = whiteid
        this.blackid = blackid
        this.chess = new Chess();
        this.manager = manager
        this.isRecovery = isRecovery
        this.lastmove = null // this is used to store the previous move ,i mean the move made
        this.movelist = []
        this.checkcolour = false
        if (!isRecovery) {
            const payload = {
                type: "start_game",
                roomId,
                fen: this.chess.fen()
            };
            this.saveGameToDB()
            this.white.send(JSON.stringify({ ...payload, color: "white" }));
            this.black.send(JSON.stringify({ ...payload, color: "black" }));
        }

    }
    async saveGameToDB() {
        try {
            await GameModel.create({
                roomid: this.roomId,
                players: {
                    white: this.whiteid,
                    black: this.blackid
                },
                fen: this.chess.fen()
                , moveList: this.movelist
                , lastMove: this.lastmove
                , turn: this.chess.turn(),
                isCheck: this.checkcolour,
                status: "active",
                winner: null

            }
            )
        } catch (error) {
            console.error("Error saving game to DB:", error);
        }
    }

    async handleMove(socket, { from, to }) {
        // enforce turn order
        // enforce turn using chess.js (authoritative)
        if (this.chess.turn() === "w" && socket !== this.white) return
        if (this.chess.turn() === "b" && socket !== this.black) return

        let move
        try {
            move = this.chess.move({ from, to, promotion: "q" });
        } catch (error) {
            socket.send(JSON.stringify(
                {
                    type: "error"
                    , message: "hey this is invalid structure"
                }
            ))
        }



        if (!move) {
            socket.send(JSON.stringify({ from, to, message: "invalid move" }));
            return;
        }


        const update = {
            fen: this.chess.fen(),
            move,
            turn: this.chess.turn(),
            movelist: this.movelist
        };
        this.lastmove = move
        this.movelist.push(move.san)
        this.checkcolour = this.chess.inCheck()
        //update the database 
        await GameModel.findOneAndUpdate(
            { roomid: this.roomId },
            {
                $set: {
                    fen: this.chess.fen()
                    , moveList: this.movelist
                    , lastMove: this.lastmove
                    , turn: this.chess.turn()
                    , isCheck: this.checkcolour
                    , updatedAt: new Date()
                }
            }
        )
        // send to everyone else (opponent + spectators)
        this.white.send(JSON.stringify({ check: this.chess.isCheck(), type: "move_made", message: "you just made a move", ...update }));

        // send to the player who moved
        this.black.send(JSON.stringify({ check: this.chess.isCheck(), type: "move_made", message: "you just made a move", ...update }));

        // GAME OVER LOGIC
        if (this.chess.isGameOver()) {
            // here there is will function call and also update the database 
            this.gameOver()
        }

    }
    async gameOver() {
        if (this.chess.isCheckmate()) {
            const loser = this.chess.turn();
            const winner = loser === "w" ? "black" : "white";

            this.white.send(JSON.stringify({ type: "game_over", reason: "checkmate", winner }));
            this.black.send(JSON.stringify({ type: "game_over", reason: "checkmate", winner }));
            await GameModel.findOneAndUpdate(
                { roomid: this.roomId }
                , {
                    $set: {
                        status: "checkmate",
                        winner: winner,
                        updatedAt: new Date()
                    }
                }
            )
            this.manager.endGame(this.roomId)
        } else {
            this.white.send(JSON.stringify({ type: "gamedraw", reason: "draw" }));
            this.black.send(JSON.stringify({ type: "gamedraw", reason: "draw" }));
            await GameModel.findOneAndUpdate(
                { roomid: this.roomId }
                , {
                    $set: {
                        status: "draw",
                        updatedAt: new Date()
                    }
                }
            )
            this.manager.endGame(this.roomId)
        }
    }
}
module.exports = { Game }
