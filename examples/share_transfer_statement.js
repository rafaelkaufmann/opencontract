import {Contract, Clause, Party, UnitState, Util} from '../lib/oc';

const should = require('chai').should();

async function example() {
    console.log('A real-world "contract". Assume the signer/oracle is some sort of interface to a company registry');
    var alicesSigKeyPair = Util.generateKeyPair(),
        bobsSigKeyPair = Util.generateKeyPair(),
        oraclesSigKeyPair = Util.generateKeyPair();

    var alice = await Party.getPartyByName('alice', alicesSigKeyPair.publicKey),
        bob = await Party.getPartyByName('bob', bobsSigKeyPair.publicKey),
        oracle = await Party.getPartyByName('oracle', oraclesSigKeyPair.publicKey);

    let text = ```
Share Transfer Statement

I, [signer], hereby declare that:
* On the 15th of October, 2014, [party] transferred 8,000 shares of the Acme Company to [counterparty];
* [party] does not, as of July 16 2015, possess any equity in the Acme Company.
    ```;

    // These are all really sketchy details of the oracle's API. The important part here is the different ways to
    // express a body.

    let b1 = async () => {
        let oracle = await Oracle(signer.name),
            transfer = await oracle.queryAsObject({ type: 'transfer', date: 'October 15 2014', party: alice.name, counterparty: bob.name, amount: 8000 }),
            position = await oracle.queryAsValue({ type: 'position', date: 'July 16 2015', party: alice.name });

        let clause1 = signer.declare(transfer.exists()),
            clause2 = signer.declare(position.equals(0));

        return clause1.and(clause2);
    };

    let b2 = Clause.and(
        Clause(signer).setState(Query.asObject(signer.name, {
            type: 'transfer', date: 'October 15 2014', party: alice.name, counterparty: bob.name, amount: 8000
        }).exists()),
        Clause(signer).setState(Query.asValue(signer.name, {
            type: 'position', date: 'July 16 2015', party: alice.name
        }).equals(0)));

    let b3 = ```
        transfer = query ${signer.name} {
          type = 'transfer', date = 'October 15 2014', party = ${alice.name}, counterparty = ${bob.name}, amount = 8000
        } |> asObject

        position = query ${signer.name} {
          type = 'position', date = 'July 16 2015', party = alice.name
        } |> asValue

        declare ${signer.name} ((exists transfer) and (position == 0))
    ```;

    let query = Oracle.query,
        declare = Party.declare;
    let b4 = async () => {
        let transfer = query(signer.name, {
                type: 'transfer', date: 'October 15 2014', party: alice.name, counterparty: bob.name, amount: 8000
            }).asObject(),
            position = query(signer.name, {
                type: 'position', date: 'July 16 2015', party: alice.name
            }).asValue();

        let clause = declare(signer.name, transfer.exists().and(position.equals(0)));

        return clause.run();
    };

    let c = new Contract({
        body: b,
        parties: {signer: oracle, party: alice, counterparty: bob},
        textVersion: {
            format: 'text/utc-8',
            contents: text
        }
    });

    await c.update();

}

example().catch(console.trace.bind(console));