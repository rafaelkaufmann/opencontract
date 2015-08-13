import {Contract, Party, State, UnitState, JointState, Util} from '../lib/oc';
import * as math from 'mathjs';

const N = x => math.bignumber(x),
    One = N(1),
    Zero = N(0);

const should = require('chai').should();

async function example() {
    console.log('Example: a trivial contract');

    let alicesSigKeyPair = Util.generateKeyPair(),
        bobsSigKeyPair = Util.generateKeyPair();

    let alice = await Registry.getPartyByName('alice', alicesSigKeyPair.publicKey),
        bob = await Registry.getPartyByName('bob', bobsSigKeyPair.publicKey);

    const x = new UnitState(0.7, 'Odin'),
        y = new UnitState(0.55, 'Vishnu'),
        z = new UnitState(0.6, 'Eris');

    let b = () => {
        let AdidX = new JointState({a: x}),
            BdidY = new JointState({b: y}),
            AdidZ = new JointState({a: z});
        return AdidX.and(BdidY).or(AdidZ).not();
    };

    let c = new Contract({
        body: b,
        parties: [alice, bob]  // Note that here we are using an *array*
    });

    await c.update();

    const actualState = c.valid.toJSON(),
        expectedState = {
            a: {
                p: 0.12,
                operator: 'not',
                children: [{
                    p: 0.88,
                    operator: 'or',
                    children: [
                        {
                            p: 0.7,
                            operator: 'and',
                            children: [
                                {
                                    p: 0.7,
                                    source: x.source
                                },
                                {
                                    p: 1,
                                    source: null
                                }
                            ]
                        },
                        {
                            p: 0.6,
                            source: z.source
                        }
                    ]
                }]
            },
            b: {
                p: 0,
                operator: 'not',
                children: [{
                    p: 1,
                    operator: 'or',
                    children: [
                        {
                            p: 0.55,
                            operator: 'and',
                            children: [
                                {
                                    p: 1,
                                    source: null
                                },
                                {
                                    p: 0.55,
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
        };

    console.log(JSON.stringify(actualState));
    console.log(JSON.stringify(expectedState));

    actualState.should.deep.equal(expectedState);

    console.log('State is correct');

}

example().catch(console.trace.bind(console));