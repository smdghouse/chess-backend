const {Kafka} = require("kafkajs");

const kafka = new Kafka({
  clientId: "chess-app",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

 async function connectProducer() {
  await producer.connect();
  console.log("✅ Producer connected");
}

 async function sendMove(moveData) {
  await producer.send({
    topic: "game-moves",
    messages: [
      {
        key: moveData.gameId,
        value: JSON.stringify(moveData),
      },
    ],
  });

  console.log("📤 Move sent:", moveData);
}
module.exports ={ sendMove, connectProducer }