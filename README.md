# OpenContract
#####Reference implementation of OpenContract (WARNING: very experimental)

##What is OpenContract?

**OpenContract is a peer-to-peer, easy-to-use legal contracting platform.** It is a formal language/operational semantics for specifying legal contracts, and also a distributed database of contracts (storage- and transport-agnostic).

A nontechnical whitepaper detailing the concepts and motivation is in the works. For now, suffice to say that

**OpenContract allows parties to write and sign a contract, publish it to distributed, P2P storage, and evaluate contract compliance, verify signatures and validity automatically.**

(This is a very different route towards "smart contracts" from what the blockchain-based projects are doing. We believe that, although mathematically airtight, self-enforcing contracts look good on paper, a more important, more achievable and more useful goal is developing adequate tools to write, evaluate and enforce real-life, subjective, "dumb contracts". But let's skip the philosophy for now.)

The JavaScript library will include the following core features (UI will be handled in a separate project):

* Create a contract, specifying at a minimum the **contract body function**. This function describes the contract as such: upon running, it is intended to compute the current contract state (valid, breached or something in between) for each party, *as currently perceived by the peer*. 
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

* The contract body and the predicates `isExpired`, `isRevoked` are expressed as JavaScript (or, if you don't like JavaScript, as any language transpilable to JavaScript; dee below). The operational semantics are given by usual JavaScript semantics plus the (sandboxed) context provided by the library.
* Most contracts will be about the Real World (c), and sometimes that world is uncertain. Thus, contract states are per-party probabilities, that is, numbers between 0 (definitely breached) and 1 (definitely not breached). We have our clever ideas for how the library will assign these numbers, but in the end, it's always in the hand of the contract writer.
* P2P will be implemented on top of existing transports. One idea is WebRTC, using the `rtc-io` modules. We will supply a switchboard for peer discovery. All peer communications will be JSON-based, so there will be little effort if one decides to use another transport.
* Oracles are how `body` is allowed to consult with the Real World (c). The same API will cater to P2P and oracling. Using a Strategy pattern, you will be able to supply any specific oracling behavior you desire for your peer. Some examples will be supplied, including one which requires human intervention.

In the interest of clarity and future-proofing, this library is written using "experimental" JavaScript features. Notably, we use `async/await` from the ECMAScript 7 spec, which rids us of "callback hell" once and for all (yay!) but will probably only become standard JavaScript in the distant future (boo!). Therefore, we primitive humanoids are forced to use [Babel](http://babeljs.io/) to transpile down to whatever version of ES our environments actually support.

The library supplies a sandboxed context for (async) execution and some treatment on deserialization, but this is still foreign code being `eval`'d. *Caveat emptor*. You should rely on human-verified signed contract templates for trust.

##API

###Contract

Contracts are the thing about which this whole thing is about. See above.

####`new Contract(params : Object)`

Instantiates a contract. The following parameters are accepted, and are all optional:

* `template : Contract` - specifies another contract to be used as this one's template. This means that you will inherit the template's parties and contract functions/predicates (if defined).
* `parties : Object<String => Party>` - specifies the parties to the contract. Each key corresponds to a party name (these names should be the same as you use in the contract functions). You can instantiate a contract without parties. It won't be something you can sign or evaluate, but it will be publishable - useful for defining templates for other contracts to use.
* `rights : Object<String => Right>` - specifies what rights the contract refers to, if any.
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

Publishes the contract on the specified registry (using `Registry.publish`). The returned contract URI object will supply, apart from the URI itself (meaning, the registry and ID where the published version can be retrieved), a serialized copy of the contract, and also a publication signature and timestamp from the peer that has received it.

####`static Contract.load(uri : ContractURI) : Promise<Contract>`

Loads a contract from an URI (having, at a minimum, the registry and ID). If the signature and timestamp are provided, they will be verified. Uses `Registry.fetch`.

###ContractBody

Represents a contract body. While we previously intended to supply an "easy-to-use DSL" for expressing contract functions in a more layman-friendly format than pure JavaScript, the current approach is to keep the library to a minimum and let users provide their own DSLs, if desired, through the language plugin approach.

####`new ContractBody(fn : Function<() => Promise<JointState>>, options : Object)`
####`new ContractBody(fn : Function<() => JointState>, options : Object)`
####`new ContractBody(fnString : String, options : Object)`

These are all the signatures accepted for the constructor. The only currently accepted option is `language`, which lets you specify in which language the body is written _if it is a String_.

Babel will transpile your application code to ES5, so if you're declaring your contract functions directly inside the app (as in `examples/trivial_contract`), they will get serialized in their transpiled, boring and ugly ES5 form. Since contract writers will want to keep their contract functions nice and readable, keep them as strings (say, within a textarea if you're writing a Web app) and declare them as in `examples/body_as_string`.

OpenContract allows for contract bodies to be written in arbitrary ES5-transpilable languages, using language plugins. See `Serializer` below.

###Signature

TODO. Don't forget to talk about: signature versioning.

###Serializer

####`Serializer.addPlugin(plugin : LanguagePlugin)`

Adds support for the specified language.

###LanguagePlugin

####`new LanguagePlugin({name : String, deserializeStrategy : FunctionDeserializeStrategy })`

###State

A State is a probabilistic representation of a clause or predicate's truth value or validity. Specifically:

* A `UnitState` is the probability that a given predicate is true. They are used to represent the merely factual, positive or informative aspect.
* A `JointState` represents the deontic, normative or prescriptive aspect of a clause - that is, whether each party is considered to be fulfilling the clause or is in breach. JointStates are created by binding UnitStates to Parties.

Thus, for example, if "Alice must have swept the floor today" is a clause, the associated predicate is "has Alice swept the floor today?". If Alice did indeed sweep the floor today, the associated states are `UnitState(true)` and `JointState({Alice: UnitState(true)})`.

####`State.and(...states : Array<State>) : State`
####`static State.and(...states : Array<State>) : State`

Returns a state which equals the probabilistic AND of the given states (`pAND = pA - pB`).

####`State.or(...states : Array<State>) : State`
####`static State.or(...states : Array<State>) : State`

Returns a state which equals the probabilistic OR of the given states (`pOR = 1 - (1 - pA) * (1 - pB)`).

####`State.not() : State`
####`static State.not(state : State) : State`

Returns a state which equals the probabilistic NOT of the given states (`pNOT = 1 - pA`).

####The Undefined State

This is a special case of a unit state, expressing ignorance of a predicate. This is the state which will be returned if a computation or query fails. Undefined states are contagious, for instance, in AND clauses.

###Party

A Party is a pseudonym (UUID) within a Registry who is able to sign contracts. A Party is published to a Registry and then becomes queriable by applications.

####`Party.declare(s : UnitState) : JointState`

The same as `new JointState({party: s})`.

###Right

A Right is a pseudonymous object (UUID) within a Registry that can be assigned to a Party by a contract. Rights are published to a Registry and then can be queried, much in the same way as a Party.

The library does not provide any facility to map between a Right and any actual piece of property. This is the application's job.

####`Right.assign(p : Party, s : UnitState) : JointState`

Assigns the right to party `p`, conditional on UnitState `s`. This encompasses both the standard "allow" and "deny" operations, but also descriptions of "gray" situations where the assignment is uncertain.

Note that the library does *not* enforce exclusivity of the right: it is possible to assign the same right to two parties. There may be an ExclusiveRight subclass in the future, but currently, if you need exclusivity/scarcity, you have to check for it on your contract code.

###Registry

Registry encapsulates a network/namespace of peers who hold contracts, similar to "testnet" or "mainnet" for Bitcoin. The only thing this 

Don't forget to talk about: handling metadata updates (parties and signatures); proofs of storage; encryption scheme; how to share encryption keys between parties; how to store encryption keys; encryption protocol versioning.

####`Registry.publish(c : Contract) : Promise<ContractURI>`

####`Registry.fetch(c : ContractURI) : Promise<Contract>`

See the corresponding methods on Contract.

###Oracle

TODO

###OracleFactory

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

##TODO

* Use hashes as contract UUIDs - Makes publish signatures redundant.
* Registry UUIDs.
* Publish Parties and Rights.
* Rename UnitState as State, and JointState as Clause.
* More comprehensive tests, including failing cases!
* Get source maps working under Babel/Node -- seems not to work with async/await...
* Publish/fetch encryption/decryption.
* Fetch validation.
* Signature versioning.
* Revocation.
* Links between contracts (eg, notion that "party A is required to be a signer of contract Y" within contract body X).
* Text version as arbitrary documents with metadata.
* Better sandbox for deserializing and running contract functions (maybe forcibly turn into ES6 modules and use Loader?).
* Instrumentation to support tracing function-style bodies, so we can map the flow of the probabilities from queries or base states to the return value.
* API for proofs of identity and web of trust. Include keypair substitution.
* Make the language plugins part of the registry, so that all peers automatically support all languages, new plugins are vetoed and given trust ratings, etc.
* Test in browser.