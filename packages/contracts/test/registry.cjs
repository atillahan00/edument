const { expect } = require('chai');
const { ethers } = require('hardhat');
describe('BILSEMChainRegistry', () => {
  let registry, admin, writer, other;
  const h = (v) => ethers.id(v);
  const args = (id = 'v1', previous = ethers.ZeroHash, version = 1) => [
    h(id),
    h('subject'),
    h('PROFILE'),
    h(id + 'content'),
    ethers.ZeroHash,
    previous,
    version,
  ];
  beforeEach(async () => {
    [admin, writer, other] = await ethers.getSigners();
    registry = await (
      await ethers.getContractFactory('BILSEMChainRegistry')
    ).deploy(admin.address, writer.address);
  });
  it('rejects unauthorized writes', async () => {
    await expect(registry.connect(other).anchor(...args())).to.be.revertedWithCustomError(
      registry,
      'AccessControlUnauthorizedAccount',
    );
  });
  it('anchors immutable records and emits proof', async () => {
    await expect(registry.connect(writer).anchor(...args()))
      .to.emit(registry, 'RecordAnchored')
      .withArgs(h('v1'), h('subject'), h('v1content'), 1);
    await expect(registry.connect(writer).anchor(...args())).to.be.revertedWithCustomError(
      registry,
      'InvalidRecord',
    );
  });
  it('links versions and preserves the original hash', async () => {
    await registry.connect(writer).anchor(...args());
    await expect(registry.connect(writer).anchor(...args('v2', h('v1'), 2))).to.emit(
      registry,
      'RecordSuperseded',
    );
    const first = await registry.getRecord(h('v1'));
    expect(first.status).eq(2);
    expect(first.contentHash).eq(h('v1content'));
    expect(first.nextRecordId).eq(h('v2'));
    expect((await registry.getRecord(h('v2'))).status).eq(1);
  });
  it('rejects forks, version gaps and foreign subjects', async () => {
    await registry.connect(writer).anchor(...args());
    await expect(registry.connect(writer).anchor(...args('v2', h('v1'), 3))).to.be.reverted;
    const foreign = args('v2', h('v1'), 2);
    foreign[1] = h('other');
    await expect(registry.connect(writer).anchor(...foreign)).to.be.reverted;
    await registry.connect(writer).anchor(...args('v2', h('v1'), 2));
    await expect(registry.connect(writer).anchor(...args('v3', h('v1'), 2))).to.be.reverted;
  });
  it('restricts revocation and retains revoked data', async () => {
    await registry.connect(writer).anchor(...args());
    await expect(registry.connect(other).revoke(h('v1'))).to.be.reverted;
    await expect(registry.connect(writer).revoke(h('v1'))).to.emit(registry, 'RecordRevoked');
    expect((await registry.getRecord(h('v1'))).status).eq(3);
    expect((await registry.getRecord(h('v1'))).contentHash).eq(h('v1content'));
  });
  it('supports role grants and removal through AccessControl events', async () => {
    const role = await registry.ANCHOR_ROLE();
    await expect(registry.grantRole(role, other.address)).to.emit(registry, 'RoleGranted');
    await registry.connect(other).anchor(...args());
    await registry.revokeRole(role, other.address);
    await expect(registry.connect(other).anchor(...args('v2', h('v1'), 2))).to.be.reverted;
  });
});
