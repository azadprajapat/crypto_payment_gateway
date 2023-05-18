const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const EC = require("elliptic").ec, ec = new EC("secp256k1");

const { Block, Blockchain, Transaction, NemaChain } = require("./chain");
const make_transaction=require('./monkcoin');
// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// Simulated data for transactions

// GET API to request all transactions
app.get('/transactions', (req, res) => {
  res.json(NemaChain);
});


// POST API to create a new transaction
app.post('/transactions', (req, res) => {   
  const { sender, receiver, amount,gas,pk } = req.body;
  const transaction = new Transaction(sender,receiver,amount,gas);
  const key_pair = ec.keyFromPrivate(pk,"hex");
  transaction.sign(key_pair);
  make_transaction(transaction);
  res.status(201).json("transaction will be published soon to the chain");
});
app.post('/balance', (req, res) => {   
    const { key } = req.body;
    res.status(200).json(NemaChain.getBalance(key));
  });
  
// Start the server
app.listen(8000, () => {
  console.log('Server started on port 8000');
});
module.exports ={app};