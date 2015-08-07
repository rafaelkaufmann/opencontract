import {Contract, Party, UnitState, Oracle, Util} from '../lib/oc';

const should = require('chai').should();

async function example() {
    console.log('A real-world "contract". Assume the signer/oracle is some sort of interface to a company registry');
    var sellersSigKeyPair = Util.generateKeyPair(),
        buyersSigKeyPair = Util.generateKeyPair(),
        oraclesSigKeyPair = Util.generateKeyPair();

    var seller = await Party.getPartyByName('seller', sellersSigKeyPair.publicKey),
        buyer = await Party.getPartyByName('buyer', buyersSigKeyPair.publicKey),
        oracle = await Party.getPartyByName('oracle', oraclesSigKeyPair.publicKey);

    let text = ```
Share Transfer Statement

I, [oracle], hereby declare that:
* On the 15th of October, 2014, [seller] transferred 8,000 shares of the Acme Company to [buyer];
* [seller] does not, as of July 16 2015, possess any equity in the Acme Company.
    ```;

    // These are all really sketchy details of the oracle's API. The important part here is the different possible
    // ways to express a contract body.

    // Regular ES7 function.
    let b1 = async () => {
        let oracle = await Oracle.fetch(oracle.name),
            transfer = await oracle.queryAsObject({ type: 'transfer', date: 'October 15 2014', seller: seller.name, buyer: buyer.name, amount: 8000 }),
            position = await oracle.queryAsValue({ type: 'position', date: 'July 16 2015', seller: seller.name });

        let clause1 = oracle.declare(transfer.exists()),
            clause2 = oracle.declare(position.equals(0));

        return clause1.and(clause2);
    };

    // Similar, with the actual contract body interspersed as JSDoc-style comments. This could be generated by a two-pane contract-editor.

    /** Share Transfer Statement */
    let b2 = async () => {
        /** 1. Definitions */
        let oracle = await Oracle.fetch(oracle.name),  /** oracle: the seller identified as [oracle.name] */
            transfer = await oracle.queryAsObject({ type: 'transfer', date: 'October 15 2014', seller: seller.name, buyer: buyer.name, amount: 8000 }),  /** transfer: The transfer having taken place on the 15th of October, 2014, from [seller] to [buyer], of 8,000 shares of the Acme Company. */
            position = await oracle.queryAsValue({ type: 'position', date: 'July 16 2015', seller: seller.name });  /** position: [seller]'s current position, in shares, of Acme Company equity. */

        /** 2. Declarations */
        let clause1 = oracle.declare(transfer.exists()),  /** oracle declares that transfer took place. */
            clause2 = oracle.declare(position.equals(0));  /** oracle declares that position equals zero. */

        return clause1.and(clause2);
    };

    // Hypothetical implementation in Elm
    let b3 = ```
        transfer = query ${oracle.name} {
          type = 'transfer', date = 'October 15 2014', seller = ${seller.name}, buyer = ${buyer.name}, amount = 8000
        } |> asObject

        position = query ${oracle.name} {
          type = 'position', date = 'July 16 2015', seller = seller.name
        } |> asValue

        declare ${oracle.name} ((exists transfer) and (position == 0))
    ```;

    // Possibly assuming some shorthands to improve readability?
    let query = Oracle.query,
        declare = Party.declare;
    let b4 = async () => {
        let transfer = query(oracle.name, {
                type: 'transfer', date: 'October 15 2014', seller: seller.name, buyer: buyer.name, amount: 8000
            }).asObject(),
            position = query(oracle.name, {
                type: 'position', date: 'July 16 2015', seller: seller.name
            }).asValue();

        let clause = declare(oracle.name, transfer.exists().and(position.equals(0)));

        return clause.run();
    };

    let c = new Contract({
        body: b1,
        parties: {oracle: oracle, seller: seller, buyer: buyer},
        textVersion: {
            format: 'text/utc-8',
            contents: text
        }
    });

    await c.update();

}

example().catch(console.trace.bind(console));