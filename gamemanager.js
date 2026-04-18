//import {nanoid} from "nanoid"
const { nanoid } = require("nanoid")
//import { Game } from "./game.js"
const { Game } = require("./game.js")
const jwt = require("jsonwebtoken")
const GameModel = require("./models/moves.js")
const { Chess } = require("chess.js")
class GameManager {
    constructor(io) {
        this.io = io
        this.games = new Map()
        this.waiting = null
        this.users = []
    }
    handlePlayer(socket) {
        this.users.push(socket)
        this.handler(socket)
    }
    handler(socket) {
        let msg;
        socket.on("message", data => {
            try {
                msg = JSON.parse(data.toString())
            } catch (error) {
                console.log(`hey client sent the invalid json ${data.toString()}`)
                return
            }
            if(msg.type === "identify")
            {
                this.handleIdentify(socket,msg.token)
                return
            }
            if (msg.type === "resign") {
                this.handleResign(socket)
                console.log("resign request received ",socket.playerid)
                return
            }

            if (msg.type === "play_game") {
                if(!socket.playerid)
                {
                    socket.send(JSON.stringify(
                        {
                            type:"error"
                            ,message:"Not authenticated(socket.playerid not found )"

                        }
                    ))
                    return
                }
                this.addPlayer(socket)
                if (!this.waiting)
                    socket.send(JSON.stringify({ type: "start_msg", message: "hey wait for your opponent " }))
            }
            else if (msg.event === "make_move") {
                this.makingMove(socket, msg.move)
                return
            }
            else {
                socket.send(JSON.stringify({ message: "you have send the invalid request " }))
            }
        })
    } addPlayer(socket) {
        if (!this.waiting) {
            this.waiting = socket
            socket.send(JSON.stringify({ type: "waiting", message: "waiting for opponent" }))
            return
        }
        if(this.waiting.playerid === socket.playerid)
        {
           this.waiting = socket
             socket.send(JSON.stringify({ type: "start_msg", message: "hey wait for your opponent " }))
           return
        }
        const roomid = nanoid(6)
        const white = this.waiting
        const black = socket
        this.waiting = null

        const game = new Game(white, black, roomid, white.playerid, black.playerid, this)
        this.games.set(roomid, game)
    }
    
    makingMove(socket, move) {
        for (const [roomId, game] of this.games.entries()) {
            if (game.white === socket || game.black === socket) {
                game.handleMove(socket, move)
                return
            }
        }
    }

    handleDisconnect(socket) {
        if (this.waiting === socket) this.waiting = null;
        for (const [roomid, game] of this.games.entries()) {
            if (game.white === socket || game.black === socket) {
                const opponent = game.black === socket ? game.white : game.black
                opponent.send(JSON.stringify({ message: "sorry to inform you that your opponent has left the world " }))
                this.games.delete(roomid)
            }
        }
    }
    endGame(roomid) {
        if (!this.games.has(roomid)) return
        this.games.delete(roomid)
        console.log("this game_room is over ", roomid)
    }
    handleIdentify(socket, token) {
        try {
            const { userid } = jwt.verify(token, process.env.JWT_SECRET)
            console.log("hey this is userid",userid)
            socket.playerid = userid
            console.log("hey this is socket.id",socket.playerid)
        } catch (error) {
            socket.send(JSON.stringify({ type: "error", message: error }))
        }
        for (const game of this.games.values()) {
             console.log("finding whiteid",game.whiteid)
            console.log("finding blackid",game.blackid)
            if (socket.playerid=== game.whiteid.toString() || socket.playerid === game.blackid.toString()) {
                const color = socket.playerid === game.whiteid.toString() ? "white" : "black"
            
            if (color === "white") {
                game.white = socket
            }
            else
                game.black = socket
            socket.send(JSON.stringify({
                type: "reconnected",   
                fen: game.chess.fen(),
                color,
                turn: game.chess.turn(),
                lastmove:game.lastmove,
                movelist: game.movelist,
                isCheck:game.checkcolour
            
            }))
            return
        }}
        console.log("no active game found for this playerid",socket.playerid)
        socket.send(JSON.stringify(
            {
                type:"not_active_game"
            }
        ))
        return
    }
    async Gamerecovery(){
        try {
            const activeGames = await GameModel.find({status:"active"})
            for(const data of activeGames){
                const game = new Game(null,null,data.roomid,data.players.white,data.players.black,this,true)
                game.chess = new Chess(data.fen)
                game.movelist = data.moveList
                game.lastmove = data.lastMove
                game.checkcolour = data.isCheck
                this.games.set(data.roomid,game)
                console.log("hey this is the active game",game.whiteid)
                console.log("recoverd game are: ",data.roomid)
            }
        } catch (error) {
            console.error("Error during game recovery:", error);
        }
    }
   async handleResign(socket) {
        for (const [roomId, game] of this.games.entries()) {
           
            // match by PLAYER ID (not socket)
            const isWhite = game.whiteid.toString() === socket.playerid;
            const isBlack = game.blackid.toString() === socket.playerid;

            if (!isWhite && !isBlack) continue;

            // decide winner
            const winner = isWhite ? "white" : "black";
            console.log("babu winner is ", winner)
            //update DB
            try{
                await GameModel.findOneAndUpdate(
                    {
                        roomid:roomId
                    },
                    {
                        $set:{
                            status:"resigned"
                            ,winner:winner
                            ,updatedAt:new Date()
                        }
                    }
                )
            }
            catch(error)
            {
                console.error("error updating game on resign:",error)
            }
            // notify players (only if socket exists)
            if (game.white) {
                game.white.send(JSON.stringify({
                    type: "game_over",
                    reason: "resign",
                    winner
                }));
            }

            if (game.black) {
                game.black.send(JSON.stringify({
                    type: "game_over",
                    reason: "resign",
                    winner
                }));
            }

            // cleanup
            this.games.delete(roomId);
            console.log("Game ended by resign:", roomId);

            return; // 🔑 IMPORTANT
        }
    }

}
module.exports = { GameManager }