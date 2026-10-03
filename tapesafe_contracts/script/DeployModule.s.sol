// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TapeSafeModule} from "../src/TapeSafeModule.sol";

/// @notice Simulates unless you pass --broadcast yourself.
///         This script deploys only TapeSafeModule. It does not create a processor
///         and it does not transfer the circuit NFT.
contract DeployModule is Script {
    function run() external {
        address circuits = vm.envAddress("CIRCUITS");
        uint256 vaultId = vm.envUint("VAULT_ID");
        uint256 ruleId = vm.envUint("RULE_ID");
        address container = vm.envAddress("CONTAINER");
        address site = vm.envOr("SITE_REGISTRY", address(0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6));
        uint256 thresholdRaw = vm.envUint("THRESHOLD");
        uint256 mustRaw = vm.envOr("MUST_MASK", uint256(0));
        require(thresholdRaw <= 255 && mustRaw <= 255, "configuration overflow");
        uint8 threshold = uint8(thresholdRaw);
        uint8 must = uint8(mustRaw);
        address[] memory signers = vm.envAddress("SIGNERS", ",");

        vm.startBroadcast();
        TapeSafeModule module = new TapeSafeModule(circuits, vaultId, ruleId, container, site, signers, threshold, must);
        vm.stopBroadcast();
        console.log("TapeSafeModule", address(module));
        console.log("Transfer the circuit NFT only after you have re-read this address.");
    }
}
