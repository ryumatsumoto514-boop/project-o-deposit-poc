// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal mock ERC-20 used ONLY because official Circle testnet USDC was
// unavailable to this wallet at build time (faucet.circle.com's public
// faucet API requires an authenticated Circle API key we don't have, and
// neither the relayer nor test wallet held any pre-existing testnet USDC).
// Same approve()/transferFrom()/balanceOf() semantics as real USDC — the
// PoC's reconciliation engine and UI treat it identically. Deployed to
// Arbitrum Sepolia (421614), holds no real value, 6 decimals to match USDC.
contract MockUSDC {
    string public name = "Mock USDC (PoC testnet only)";
    string public symbol = "mUSDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 initialSupply) {
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "MockUSDC: insufficient allowance");
        allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "MockUSDC: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
