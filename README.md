# OpenContract
#####Reference implementation of OpenContract (WARNING: very experimental)

##What is OpenContract?

**OpenContract is a peer-to-peer, easy-to-use legal contracting platform.** It is a formal language/operational semantics for specifying legal contracts, and also a distributed database of contracts (storage- and transport-agnostic).

A nontechnical whitepaper detailing the concepts and motivation is in the works. For now, suffice to say that

**OpenContract allows parties to write and sign a contract, publish it to distributed, P2P storage, and evaluate contract compliance, verify signatures and validity automatically.**

(This is a very different route towards "smart contracts" from what the blockchain-based projects are doing. We believe that, before we can have mathematically airtight, self-enforcing contracts, it would be nice to first have adequate tools to write and evaluate real-life, subjective, "dumb contracts". But let's skip the philosophy for now.)

The JavaScript library will include the core (non-UI) features:

* Create a contract, specifying at a minimum the **contract body function**. This function describes the contract as such: upon running, it is intended to (asynchronously) compute the current contract state (valid, breached or something in between) for each party, *as currently perceived by the peer*. 
* Specify **parties** (keypairs with UUIDs) for a contract.
* Sign a contract with a party's private key.
* Revoke a signature.
* Store a serialized contract.
* Discover peers using a switchboard.
* Publish a contract to a peer, in plaintext or encrypted form.
* Receive a contract published by another peer, decide whether to store it or discard it, and whether to forward it to other peers.
* Read and deserialize a stored or received contract.
* Obtain the updated state of a contract (verify signatures, run the body function, etc).
* Query an oracle (really, just any old peer) with a JSON "question".
* Respond to queries from other peers.

The philosophy is to achieve all this in a very lightweight fashion, by exploiting existing solutions. Thus:

* By default, the contract body and the predicates `isExpired`, `isRevoked` are all written as JavaScript. The library supplies a sandboxed context for (async) execution and some treatment on deserialization, but this is still foreign code being `eval`'d. *Caveat emptor*. You should rely on human-verified signed contract templates for trust.
* Alternatively, you can use Clauses, a simple, purely declarative DSL that is able to express most useful contracts. In virtue of it not being Turing-complete, contracts using Clauses are inherently more safe, which should be weighed against their limited expressiveness.
* Most contracts will be about the Real World (c), and sometimes that world is uncertain. Thus, contract states are per-party probabilities, that is, numbers between 0 (definitely breached) and 1 (definitely not breached). We have our clever ideas for how the library will assign these numbers, but in the end, it's always in the hand of the contract writer.
* P2P will be implemented on top of WebRTC, using the `rtc-io` modules. We will supply a switchboard for peer discovery. All peer communications will be JSON-based, so there will be little effort if one decides to use another transport.
* Oracles are how `body` is allowed to consult with the Real World (c). The same API will cater to P2P and oracling. Using a Strategy pattern, you will be able to supply any specific oracling behavior you desire for your peer. Some examples will be supplied, including one which requires human intervention.

In the interest of clarity and future-proofing, this library is written using "experimental" JavaScript features. Notably, we use `async/await` from the ECMAScript 7 spec, which rids us of callback hell once and for all (yay!) but will probably only become standard JavaScript in the distant future (boo!). Therefore, we primitive humanoids are forced to use [Babel](http://babeljs.io/) to transpile down to whatever version of ES our environments actually support.

Babel will transpile your application code to ES5, so if you're declaring your contract functions directly inside the app (as in `examples/trivial_contract`), they will get serialized in their transpiled, boring and ugly ES5 form. Since contract writers will want to keep their contract functions nice and readable, keep them as strings (say, within a textarea if you're writing a Web app) and, when instantiating the contract, use `new ContractBody(fnString, {language: 'es7'})`. See below.

##API

###Contract

Contracts are the thing about which this whole thing is about. See above.

####`new Contract(params : Object)`

Instantiates a contract. The following parameters are accepted, and are all optional:

* `template : Contract` - specifies another contract to be used as this one's template. This means that you will inherit the template's parties and contract functions/predicates (if defined).
* `parties : Object<String => Party>` - specifies the parties to the contract. Each key corresponds to a party name (these names should be the same as you use in the clauses). You can instantiate a contract without parties. It won't be something you can sign or evaluate, but it will be publishable - useful for defining templates for other contracts to use.
* `signatures : Object<String => Signature>` - these are signatures from (a subset of) the parties. These will usually be generated by the `sign` method, but if for some reason you want to import existing signatures, you can.
* `revocationSignatures : Object<String => Signature>` - TODO - if a party decides to revoke her signature, she does so by generating a special signature, usually by the `revoke` method.
* `body : ContractBody` - defines the "contract body" - that is, under which conditions it should be considered to be valid or breached for each party. If you pass something else than an instance of ContractBody, it will be instantiated using the constructor. The default is for contract to be considered always valid (this is useful somehow?).
* `isExpired : Function<() => Promise<Boolean>>` - TODO - defines a custom expiration criterion for your contract - the default is for your contract to never expire.
* `isRevoked : Function<() => Promise<Boolean>>` - TODO - defines a custom revocation criterion for your contract - the default is for your contract to be revoked if any of the parties publish a revocation signature.
* `textVersion : Document` - TODO - supplies a natural-language text version of the contract, in arbitrary format (see below).

Note: the contract functions are async, as per the ES7 spec, but regular functions work as well.

TODO - privacy aspect, defining which contract elements are public (published in plaintext) and which are private (published with encryption).

####`Contract.update() : Promise<Contract>`

Executes the contract functions, verifies all signatures (if any) and updates the internal state accordingly.

####`Contract.sign(privateKeys : Object<String => PrivateKey>) : Promise<Contract>`

Signs the contract with the private keys supplied for each party in the `privateKeys` dictionary and verifies the signatures against the provided public keys (if any). You can invoke this method separately for each party, even sign with the wrong private key and amend it afterwards with the right one.

####`Contract.revoke(privateKeys : Object<String => PrivateKey>) : Promise<Contract>`

TODO

####`Contract.publish(r : Registry) : Promise<ContractURI>`

Publishes the contract on the specified registry. The returned contract URI object will supply, apart from the URI itself (meaning, the registry and ID where the published version can be retrieved), a serialized copy of the contract, and also a publication signature and timestamp from the peer that has received it.

####`static Contract.load(uri : ContractURI) : Promise<Contract>`

Loads a contract from an URI (having, at a minimum, the registry and ID). If the signature and timestamp are provided, they will be verified.

###ContractBody

Represents a contract body.

####`new ContractBody(fn : Function<() => Promise<JointState>>, options : Object)`
####`new ContractBody(fn : Function<() => JointState>, options : Object)`
####`new ContractBody(clause : Clause, options : Object)`
####`new ContractBody(fnString : String, options : Object)`

These are all the signatures accepted for the constructor. The only currently accepted option is `language`, which lets you specify in which language the body is written _if it is a function_ (the default is `es5`, but see above).

TODO - Allow arbitrary ES5-transpilable languages through plugins.

###Signature

TODO. Don't forget to talk about: signature versioning.

###Clause

Clauses are an alternative way to express contract bodies. They can be composed in various ways, described below. Compound clauses form simple data structures which are easy and fast to interpret.

####`new Clause(party : Party | String | Int) : Clause`

Returns a Clause primed to refer only to a given party (identified by name or object).

####`Clause.setState(state : State) : Clause`

Returns a Clause with a given (static) state.

####`static Clause.and(clauses : Clause*) : Clause`

Returns a clause which will evaluate to the probabilistic AND of the child clauses's evaluation. Serial evaluation. Short-circuiting applies only for values of exactly zero for all parties.

####`static Clause.or(clauses : Clause*) : Clause`

Returns a clause which will evaluate to the probabilistic OR of the child clauses's evaluation. Serial evaluation. Short-circuiting applies only for values of exactly one for all parties.

####`static Clause.not(clause : Clause) : Clause`

Returns a clause which will evaluate to the probabilistic NOT of the child clauses's evaluation.

TODO: Decide whether to include parallel-evaluated versions. Will have to handle the same query running in parallel, locks... yuck!

####`Clause.query(oracle : Oracle, query : Query) : Clause`

Returns a clause which will evaluate to the result of querying oracle with the given query. Result will be memoized within runs.

####`Clause.where(defs : Object) : Function<() => Promise<JointState>`

Receives a dictionary of definitions and binds them to any unresolved subclauses. TODO: write more on the semantics of definitions.

###State

TODO. Don't forget to talk about: the Undefined State.

###Right

TODO

###Party

TODO

###Registry

TODO. Don't forget to talk about: handling metadata updates (parties and signatures); proofs of storage; encryption scheme; how to share encryption keys between parties; how to store encryption keys; encryption protocol versioning.

###Peer

TODO

###Oracle

TODO

###Util

Utility functions.

####Util.generateKeyPair()

Produces a key pair with format `{privateKey: Buffer, publicKey: Buffer}`, which will be accepted by the relevant API methods.

##Testing

The below will execute the examples, which have plenty of functional tests.

```
npm install
node bootstrap.js
```
