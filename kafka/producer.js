const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "chess-app",
  brokers: [process.env.KAFKA_BROKER],
  ssl: true,
  sasl: {
    mechanism: "scram-sha-256",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
});

const producer = kafka.producer();

async function connectProducer() {
  try {
    await producer.connect();
    console.log("✅ Producer connected");
  } catch (err) {
    console.log("⚠️ Kafka producer unavailable, skipping...", err.message);
  }
}

async function sendMove(moveData) {
  try {
    await producer.send({
      topic: process.env.KAFKA_TOPIC || "chess-moves",
      messages: [
        {
          key: moveData.gameId,
          value: JSON.stringify(moveData),
        },
      ],
    });
    console.log("📤 Move sent:", moveData);
  } catch (err) {
    console.log("⚠️ Failed to send move to Kafka:", err.message);
  }
}

module.exports = { sendMove, connectProducer };