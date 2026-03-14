// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CharityRegistry {
    struct Charity {
        string name;
        string category;
        address wallet;
        string metadataURI;
        bool active;
        uint256 addedAt;
    }

    address public owner;
    mapping(address => Charity) public charities;
    address[] public charityList;

    event NewCharityAdded(address indexed wallet, string name, string category);
    event CharityRemoved(address indexed wallet);

    modifier onlyOwner() {
        require(msg.sender == owner, "CharityRegistry: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addCharity(Charity calldata charity) external onlyOwner {
        require(charity.wallet != address(0), "CharityRegistry: zero address");
        require(!charities[charity.wallet].active, "CharityRegistry: already active");
        charities[charity.wallet] = Charity({
            name: charity.name,
            category: charity.category,
            wallet: charity.wallet,
            metadataURI: charity.metadataURI,
            active: true,
            addedAt: block.timestamp
        });
        charityList.push(charity.wallet);
        emit NewCharityAdded(charity.wallet, charity.name, charity.category);
    }

    function removeCharity(address wallet) external onlyOwner {
        require(charities[wallet].active, "CharityRegistry: not active");
        charities[wallet].active = false;
        emit CharityRemoved(wallet);
    }

    function getActiveCharities() external view returns (Charity[] memory) {
        uint256 count;
        for (uint256 i = 0; i < charityList.length; i++) {
            if (charities[charityList[i]].active) count++;
        }
        Charity[] memory result = new Charity[](count);
        uint256 idx;
        for (uint256 i = 0; i < charityList.length; i++) {
            if (charities[charityList[i]].active) {
                result[idx++] = charities[charityList[i]];
            }
        }
        return result;
    }

    function getCharity(address wallet) external view returns (Charity memory) {
        return charities[wallet];
    }

    function totalCharities() external view returns (uint256) {
        return charityList.length;
    }
}
