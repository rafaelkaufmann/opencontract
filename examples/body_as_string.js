import {Contract, Party, State, Registry, Util, ContractBody} from '../lib/oc';

const should = require('chai').should();

async function example() {
    console.log('Example: contract body as string');

    let registry = new Registry('local');

    var alicesSigKeyPair = Util.generateKeyPair(),
        bobsSigKeyPair = Util.generateKeyPair();

    var alice = await registry.getPartyByName('alice', alicesSigKeyPair.publicKey),
        bob = await registry.getPartyByName('bob', bobsSigKeyPair.publicKey);

    var c1 = new Contract({
        body: new ContractBody('async () => new JointState({alice: UnitState.trueState, bob: UnitState.trueState})', {language: 'es7'}),
        parties: {alice, bob}
    });

    console.log('Created original');

    await c1.update();  // update() syncs the internal contract state

    console.log('Updated original');

    c1.expired.should.equal(false);
    c1.revoked.should.equal(false);
    c1.valid.toJSON().should.deep.equal({ alice: { p: 1, source: null }, bob: { p: 1, source: null } });
    c1.signed.should.deep.equal({alice: false, bob: false});

    await c1.sign({alice: alicesSigKeyPair.privateKey, bob: bobsSigKeyPair.privateKey});

    console.log('Signed original');

    c1.signed.should.deep.equal({alice: true, bob: true});

    console.log('Verified original');

    const published = await c1.publish(new Registry('local'));

    console.log('Published original');

    let c2 = await Contract.load(published);

    console.log('Loaded copy');

    await c2.update();

    console.log('Updated copy');

    c2.signed.should.deep.equal({alice: true, bob: true});

    console.log('Verified copy');

}

example().catch(console.trace.bind(console));