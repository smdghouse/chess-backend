const express = require("express")
const http = require("http")
const {WebSocketServer} = require("ws")
const {GameManager} = require("./gamemanager.js")
const connectDB = require("./config/db.js")
const cors = require('cors')
const authroutes = require('./Routes/authroutes.js')
const { error } = require("console")
require("dotenv").config()
const app = express()


//using middleware 
app.use(cors())
app.use(express.json())

app.use('/auth',authroutes)
app.get('/',(req,res)=>{
res.send("chess + backend running")
})
const server = http.createServer(app)
const wss = new WebSocketServer({server})
// async function to connect DB and for Gamereovery
async function startServer(){
  await connectDB()
  const gm = new GameManager(wss)
  await gm.Gamerecovery()
  // on connection to the websocket 
wss.on("connection",ws=>
{
console.log("hey welcome to websocket server")
ws.send(JSON.stringify({ message:"finally we are conneected "}))
gm.handlePlayer(ws)
}
)

//listenin to the port 
const PORT = process.env.PORT || 8080 
server.listen(PORT,()=>{
  console.log(`finally server is started on http://localhost:${PORT}`)
})
}

startServer().catch((error)=>{
  console.error("Error starting server:",error)
})


