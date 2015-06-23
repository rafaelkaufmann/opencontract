# OpenContract
#####Reference implementation of OpenContract (WARNING: very experimental)

##What is OpenContract?

**OpenContract is a peer-to-peer, easy-to-use contracting platform.** It is a formal contract language (defined as JavaScript inside a sandbox with the OpenContract library included), and also a distributed database of contracts (storage- and transport-agnostic).

A nontechnical whitepaper detailing the concepts and motivation is in the works. For now, suffice to say that

**OpenContract allows parties to write and sign a contract, publish it to distributed, P2P storage, and evaluate contract compliance, verify signatures and validity automatically.**

(This is a very different route towards "smart contracts" from what the blockchain-based projects are doing. We believe that, before we can have mathematically airtight, self-enforcing contracts, it would be nice to first have adequate tools to write and evaluate real-life, subjective, "dumb contracts". But let's skip the philosophy for now.)

The JavaScript library will include the core (non-UI) features:
* Create a contract template, specifying the **compliance state function** *getState*. This function describes the contract as such: upon running, it is intended to (asynchronously) compute the current contract state (valid, breached or something in between) for each party, *as currently perceived by the peer*. 
* Instantiate a contract template by specifying *parties* (keypairs with UUIDs).
* Have parties sign a contract with their private keys.
* Store a serialized contract.
* Discover peers using a switchboard.
* Publish a contract to a peer.
* Receive a contract published by another peer, decide whether to store it or discard it, and whether to forward it to other peers.
* Read and deserialize a stored or received contract.
* Obtain the updated state of a contract (verify signatures, run the compliance state function, etc).
* Query an oracle (really, just any old peer) with a JSON "question".
* Respond to queries from other peers.

The philosophy is to achieve all this in a very lightweight fashion, by exploiting existing solutions. Thus:
* The contract states and predicates (the compliance state function *getState*, *isExpired*, *isRevoked*) are all written as JavaScript, serialized by the super-simple `serialize-javascript` module. To use a deserialized contract, a peer must run these functions under appropriate sandboxing to avoid exploits. No guarantees are given by the library.
* Most contracts will be about the Real World (c), and sometimes that world is uncertain. Thus, contract states are per-party probabilities, that is, numbers between 0 (definitely breached) and 1 (definitely not breached). We have our clever ideas for how the library will assign these numbers, but in the end, it's always in the hand of the contract writer.
* P2P will be implemented on top of WebRTC, using the `rtc-io` modules. We will supply a switchboard for peer discovery. All peer communications will be JSON-based, so there will be little effort if one decides to use another transport.
* Oracles are how *getState* is allowed to consult with the Real World (c). The same API will cater to P2P and oracling. Using a Strategy pattern, you will be able to supply any specific oracling behavior you desire for your peer. Some examples will be supplied, including one which requires human intervention.

In the interest of clarity and future-proofing, this library is written using "experimental" JavaScript features. Notably, we use `async/await` from the ECMAScript 7 spec, which rids us of callback hell once and for all (yay!) but will probably only become standard JavaScript in the distant future (boo!). Therefore, we primitive humanoids are forced to use [Babel](http://babeljs.io/).

##API

[TODO]

##Testing

The below will execute the examples, which have plenty of functional tests.

```
npm install
node bootstrap.js
```
