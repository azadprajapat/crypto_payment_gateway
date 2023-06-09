const crypto = require("crypto"); SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec, ec = new EC("secp256k1");
const { Block, Blockchain, Transaction, NemaChain } = require("./chain");

const MINT_PRIVATE_ADDRESS = "0700a1ad28a20e5b2a517c00242d3e25a88d84bf54dce9e1733e6096e6d6495e";
const MINT_KEY_PAIR = ec.keyFromPrivate(MINT_PRIVATE_ADDRESS, "hex");
const MINT_PUBLIC_ADDRESS = MINT_KEY_PAIR.getPublic("hex");

const privateKey = "39a4a81e8e631a0c51716134328ed944501589b447f1543d9279bacc7f3e3de7";
const keyPair = ec.keyFromPrivate(privateKey, "hex");
const publicKey = keyPair.getPublic("hex");

const WS = require("ws"); 
const currentIP="localhost";
const PORT = 3000;
const PEERS = ["ws://43.205.198.20:3000","ws://15.206.66.43:3000","ws://43.205.117.60:3000"];
const MY_ADDRESS = "ws://"+currentIP+":3000";
const server = new WS.Server({ port: PORT });
let opened = [], connected = [];
let check = [];
let checked = [];
let checking = false;
let tempChain = new Blockchain();

console.log("Listening on PORT", PORT);

server.on("connection", async (socket, req) => {
    socket.on("message", message => {
        const _message = JSON.parse(message);

        console.log(_message);

        switch(_message.type) {
            case "TYPE_REPLACE_CHAIN":
                const [ newBlock, newDiff ] = _message.data;

                const ourTx = [...NemaChain.transactions.map(tx => JSON.stringify(tx))];
                const theirTx = [...newBlock.data.filter(tx => tx.from !== MINT_PUBLIC_ADDRESS).map(tx => JSON.stringify(tx))];
                const n = theirTx.length;

                if (newBlock.prevHash !== NemaChain.getLastBlock().prevHash) {
                    for (let i = 0; i < n; i++) {
                        const index = ourTx.indexOf(theirTx[0]);

                        if (index === -1) break;
                        
                        ourTx.splice(index, 1);
                        theirTx.splice(0, 1);
                    }

                    if (
                        theirTx.length === 0 &&
                        SHA256(NemaChain.getLastBlock().hash + newBlock.timestamp + JSON.stringify(newBlock.data) + newBlock.nonce) === newBlock.hash &&
                        newBlock.hash.startsWith("000" + Array(Math.round(Math.log(NemaChain.difficulty) / Math.log(16) + 1)).join("0")) &&
                        Block.hasValidTransactions(newBlock, NemaChain) &&
                        (parseInt(newBlock.timestamp) > parseInt(NemaChain.getLastBlock().timestamp) || NemaChain.getLastBlock().timestamp === "") &&
                        parseInt(newBlock.timestamp) < Date.now() &&
                        NemaChain.getLastBlock().hash === newBlock.prevHash &&
                        (newDiff + 1 === NemaChain.difficulty || newDiff - 1 === NemaChain.difficulty)
                    ) {
                        NemaChain.chain.push(newBlock);
                        NemaChain.difficulty = newDiff;
                        NemaChain.transactions = [...ourTx.map(tx => JSON.parse(tx))];
                    }
                } else if (!checked.includes(JSON.stringify([newBlock.prevHash, NemaChain.chain[NemaChain.chain.length-2].timestamp || ""]))) {
                    checked.push(JSON.stringify([NemaChain.getLastBlock().prevHash, NemaChain.chain[NemaChain.chain.length-2].timestamp || ""]));

                    const position = NemaChain.chain.length - 1;

                    checking = true;

                    sendMessage(produceMessage("TYPE_REQUEST_CHECK", MY_ADDRESS));

                    setTimeout(() => {
                        checking = false;

                        let mostAppeared = check[0];

                        check.forEach(group => {
                            if (check.filter(_group => _group === group).length > check.filter(_group => _group === mostAppeared).length) {
                                mostAppeared = group;
                            }
                        })

                        const group = JSON.parse(mostAppeared)

                        NemaChain.chain[position] = group[0];
                        NemaChain.transactions = [...group[1]];
                        NemaChain.difficulty = group[2];

                        check.splice(0, check.length);
                    }, 5000);
                }

                break;

            case "TYPE_REQUEST_CHECK":
                opened.filter(node => node.address === _message.data)[0].socket.send(
                    JSON.stringify(produceMessage(
                        "TYPE_SEND_CHECK",
                        JSON.stringify([NemaChain.getLastBlock(), NemaChain.transactions, NemaChain.difficulty])
                    ))
                );

                break;

            case "TYPE_SEND_CHECK":
                if (checking) check.push(_message.data);

                break;

            case "TYPE_CREATE_TRANSACTION":
                const transaction = _message.data;

                NemaChain.addTransaction(transaction);

                break;

            case "TYPE_SEND_CHAIN":
                const { block, finished } = _message.data;

                if (!finished) {
                    tempChain.chain.push(block);
                } else {
                    tempChain.chain.push(block);
                    if (Blockchain.isValid(tempChain)) {
                        NemaChain.chain = tempChain.chain;
                    }
                    tempChain = new Blockchain();
                }

                break;

            case "TYPE_REQUEST_CHAIN":
                const socket = opened.filter(node => node.address === _message.data)[0].socket;
                
                for (let i = 1; i < NemaChain.chain.length; i++) {
                    socket.send(JSON.stringify(produceMessage(
                        "TYPE_SEND_CHAIN",
                        {
                            block: NemaChain.chain[i],
                            finished: i === NemaChain.chain.length - 1
                        }
                    )));
                }

                break;

            case "TYPE_REQUEST_INFO":
                opened.filter(node => node.address === _message.data)[0].socket.send(JSON.stringify(produceMessage(
                    "TYPE_SEND_INFO",
                    [NemaChain.difficulty, NemaChain.transactions]
                )));

                break;

            case "TYPE_SEND_INFO":
                [ NemaChain.difficulty, NemaChain.transactions ] = _message.data;
                
                break;

            case "TYPE_HANDSHAKE":
                const nodes = _message.data;

                nodes.forEach(node => connect(node))
        }
    });
})

async function connect(address) {
	if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
		const socket = new WS(address);

		socket.on("open", () => {
			socket.send(JSON.stringify(produceMessage("TYPE_HANDSHAKE", [MY_ADDRESS, ...connected])));

			opened.forEach(node => node.socket.send(JSON.stringify(produceMessage("TYPE_HANDSHAKE", [address]))));

			if (!opened.find(peer => peer.address === address) && address !== MY_ADDRESS) {
				opened.push({ socket, address });
			}

			if (!connected.find(peerAddress => peerAddress === address) && address !== MY_ADDRESS) {
				connected.push(address);
			}
		});

		socket.on("close", () => {
			opened.splice(connected.indexOf(address), 1);
			connected.splice(connected.indexOf(address), 1);
		});
	}
}

function produceMessage(type, data) {
	return { type, data };
}

function sendMessage(message) {
	opened.forEach(node => {
		node.socket.send(JSON.stringify(message));
	})
}
module.exports= async function make_transaction(transaction){
    sendMessage(produceMessage("TYPE_CREATE_TRANSACTION",transaction));
    NemaChain.addTransaction(transaction);
}

process.on("uncaughtException", err => console.log(err));


setInterval(() => {
    PEERS.forEach(peer => connect(peer)); 
}, 60000);


setTimeout(() => {
	if (NemaChain.transactions.length !== 0) {
		NemaChain.mineTransactions(publicKey);

		sendMessage(produceMessage("TYPE_REPLACE_CHAIN", [
			NemaChain.getLastBlock(),
			NemaChain.difficulty
		]))
	}
}, 6500);

setTimeout(() => {
	console.log(opened);
	console.log(NemaChain);
}, 10000);