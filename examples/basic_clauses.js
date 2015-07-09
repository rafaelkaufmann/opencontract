import {Contract, Clause, Party, UnitState, Util} from '../lib/oc';

const should = require('chai').should();

async function example() {
    let alicesSigKeyPair = Util.generateKeyPair(),
        bobsSigKeyPair = Util.generateKeyPair();

    let alice = await Party.getPartyByName('alice', alicesSigKeyPair.publicKey),
        bob = await Party.getPartyByName('bob', bobsSigKeyPair.publicKey);

    const x = new UnitState(0.7, 'Odin'),
        y = new UnitState(0.5, 'Vishnu'),
        z = new UnitState(0.6, 'Eris');

    let b = Clause.not(Clause.or(Clause.and('AdidX', 'BdidY'), 'AdidZ')).where({
        AdidX: Clause.single(0, x),
        BdidY: Clause.single(1, y),
        AdidZ: Clause.single(0, z)
    });

    let c = new Contract({
        body: b,
        parties: [alice, bob]  // Note that here we are using an *array*
    });

    await c.update();

    c.valid.should.deep.equal({
        p: [(1 - x.p)*(1 - z.p), (1 - x.p)*(1 - z.p)],
        $not: {
            p: [1 - (1 - x.p)*(1 - z.p), 1 - (1 - x.p)*(1 - z.p)],
            $or: [
                {
                    p: [x.p, y.p],
                    $and: [
                        {
                            p: [x.p, 1],
                            $source: [x.source, null]
                        },
                        {
                            p: [1, y.p],
                            $source: [null, x.source]
                        }
                    ]
                },
                {
                    p: [z.p, 1],
                    $source: [z.source, null]
                }
            ]
        }
    });

    console.log('State is correct');

}

example().catch(console.trace.bind(console));