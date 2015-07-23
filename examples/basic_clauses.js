import {Contract, Party, State, UnitState, JointState, Util} from '../lib/oc';

const should = require('chai').should();

async function example() {
    let alicesSigKeyPair = Util.generateKeyPair(),
        bobsSigKeyPair = Util.generateKeyPair();

    let alice = await Party.getPartyByName('alice', alicesSigKeyPair.publicKey),
        bob = await Party.getPartyByName('bob', bobsSigKeyPair.publicKey);

    const x = new UnitState(0.7, 'Odin'),
        y = new UnitState(0.55, 'Vishnu'),
        z = new UnitState(0.6, 'Eris');

    let b = () => {
        let AdidX = new JointState({a: x}),
            BdidY = new JointState({b: y}),
            AdidZ = new JointState({a: z});
        return State.not(State.or(State.and(AdidX, BdidY), AdidZ));
    };

    let c = new Contract({
        body: b,
        parties: [alice, bob]  // Note that here we are using an *array*
    });

    await c.update();

    c.valid.should.deep.equal({
        a: {
            p: (1 - x.p)*(1 - z.p),
            operator: 'not',
            children: [{
                p: 1 - (1 - x.p)*(1 - z.p),
                operator: 'or',
                children: [
                    {
                        p: x.p,
                        operator: 'and',
                        children: [
                            {
                                p: x.p,
                                source: x.source
                            },
                            {
                                p: 1,
                                source: null
                            }
                        ]
                    },
                    {
                        p: z.p,
                        source: z.source
                    }
                ]
            }]
        },
        b: {
            p: (1 - y.p),
            operator: 'not',
            children: [{
                p: 1 - (1 - y.p),
                operator: 'or',
                children: [
                    {
                        p: y.p,
                        operator: 'and',
                        children: [
                            {
                                p: 1,
                                source: null
                            },
                            {
                                p: y.p,
                                source: y.source
                            }
                        ]
                    },
                    {
                        p: 1,
                        source: null
                    }
                ]
            }]
        }
    });

    console.log('State is correct');

}

example().catch(console.trace.bind(console));