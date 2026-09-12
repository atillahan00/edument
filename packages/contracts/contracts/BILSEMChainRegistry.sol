// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Stores integrity metadata only. Never submit personal information.
contract BILSEMChainRegistry is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    enum Status { Missing, Active, Superseded, Revoked }
    struct Record {
        bytes32 subjectRef;
        bytes32 recordType;
        bytes32 contentHash;
        bytes32 documentHash;
        bytes32 previousRecordId;
        bytes32 nextRecordId;
        uint32 version;
        address issuer;
        uint64 timestamp;
        Status status;
    }
    mapping(bytes32 => Record) private records;
    event RecordAnchored(bytes32 indexed recordId, bytes32 indexed subjectRef, bytes32 contentHash, uint32 version);
    event RecordSuperseded(bytes32 indexed recordId, bytes32 indexed successorId);
    event RecordRevoked(bytes32 indexed recordId, address indexed verifier);
    error InvalidRecord();
    constructor(address admin, address anchorer) {
        require(admin != address(0) && anchorer != address(0));
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ANCHOR_ROLE, anchorer);
        _grantRole(VERIFIER_ROLE, anchorer);
    }
    function anchor(bytes32 id, bytes32 subject, bytes32 kind, bytes32 hash, bytes32 document, bytes32 previous, uint32 version) external onlyRole(ANCHOR_ROLE) {
        if (id == bytes32(0) || subject == bytes32(0) || kind == bytes32(0) || hash == bytes32(0) || records[id].status != Status.Missing) revert InvalidRecord();
        if (previous == bytes32(0)) {
            if (version != 1) revert InvalidRecord();
        } else {
            Record storage parent = records[previous];
            if (parent.status != Status.Active || parent.subjectRef != subject || parent.recordType != kind || version != parent.version + 1) revert InvalidRecord();
            parent.status = Status.Superseded;
            parent.nextRecordId = id;
            emit RecordSuperseded(previous, id);
        }
        records[id] = Record(subject, kind, hash, document, previous, bytes32(0), version, msg.sender, uint64(block.timestamp), Status.Active);
        emit RecordAnchored(id, subject, hash, version);
    }
    function revoke(bytes32 id) external onlyRole(VERIFIER_ROLE) {
        if (records[id].status == Status.Missing || records[id].status == Status.Revoked) revert InvalidRecord();
        records[id].status = Status.Revoked;
        emit RecordRevoked(id, msg.sender);
    }
    function getRecord(bytes32 id) external view returns (Record memory) { return records[id]; }
}
