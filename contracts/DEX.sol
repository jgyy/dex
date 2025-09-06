// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DEX is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Pool {
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalLiquidity;
        mapping(address => uint256) liquidity;
    }

    mapping(address => mapping(address => Pool)) public pools;
    mapping(address => mapping(address => bool)) public poolExists;
    
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public feePercentage = 30; // 0.3% fee
    
    event PoolCreated(address indexed token0, address indexed token1);
    event LiquidityAdded(
        address indexed provider,
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor() {}

    function createPool(address token0, address token1) external {
        require(token0 != token1, "Identical tokens");
        require(token0 != address(0) && token1 != address(0), "Zero address");
        
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        require(!poolExists[tokenA][tokenB], "Pool already exists");
        
        poolExists[tokenA][tokenB] = true;
        emit PoolCreated(tokenA, tokenB);
    }

    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external nonReentrant returns (uint256 amount0, uint256 amount1, uint256 liquidity) {
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        require(poolExists[tokenA][tokenB], "Pool does not exist");
        
        Pool storage pool = pools[tokenA][tokenB];
        
        if (pool.reserve0 == 0 && pool.reserve1 == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            pool.totalLiquidity = MINIMUM_LIQUIDITY;
        } else {
            uint256 amount1Optimal = quote(amount0Desired, pool.reserve0, pool.reserve1);
            if (amount1Optimal <= amount1Desired) {
                amount0 = amount0Desired;
                amount1 = amount1Optimal;
            } else {
                uint256 amount0Optimal = quote(amount1Desired, pool.reserve1, pool.reserve0);
                require(amount0Optimal <= amount0Desired, "Insufficient amount");
                amount0 = amount0Optimal;
                amount1 = amount1Desired;
            }
            
            liquidity = min(
                (amount0 * pool.totalLiquidity) / pool.reserve0,
                (amount1 * pool.totalLiquidity) / pool.reserve1
            );
        }
        
        require(liquidity > 0, "Insufficient liquidity minted");
        
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), token0 < token1 ? amount0 : amount1);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), token0 < token1 ? amount1 : amount0);
        
        pool.reserve0 += token0 < token1 ? amount0 : amount1;
        pool.reserve1 += token0 < token1 ? amount1 : amount0;
        pool.totalLiquidity += liquidity;
        pool.liquidity[msg.sender] += liquidity;
        
        emit LiquidityAdded(msg.sender, tokenA, tokenB, amount0, amount1, liquidity);
    }

    function removeLiquidity(
        address token0,
        address token1,
        uint256 liquidity
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        require(poolExists[tokenA][tokenB], "Pool does not exist");
        
        Pool storage pool = pools[tokenA][tokenB];
        require(pool.liquidity[msg.sender] >= liquidity, "Insufficient liquidity");
        
        amount0 = (liquidity * pool.reserve0) / pool.totalLiquidity;
        amount1 = (liquidity * pool.reserve1) / pool.totalLiquidity;
        
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");
        
        pool.liquidity[msg.sender] -= liquidity;
        pool.totalLiquidity -= liquidity;
        pool.reserve0 -= amount0;
        pool.reserve1 -= amount1;
        
        IERC20(tokenA).safeTransfer(msg.sender, token0 < token1 ? amount0 : amount1);
        IERC20(tokenB).safeTransfer(msg.sender, token0 < token1 ? amount1 : amount0);
        
        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amount0, amount1, liquidity);
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "Same token");
        (address token0, address token1) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        require(poolExists[token0][token1], "Pool does not exist");
        
        Pool storage pool = pools[token0][token1];
        
        bool isToken0 = tokenIn == token0;
        uint256 reserveIn = isToken0 ? pool.reserve0 : pool.reserve1;
        uint256 reserveOut = isToken0 ? pool.reserve1 : pool.reserve0;
        
        uint256 amountInWithFee = (amountIn * (10000 - feePercentage)) / 10000;
        amountOut = getAmountOut(amountInWithFee, reserveIn, reserveOut);
        
        require(amountOut >= minAmountOut, "Insufficient output amount");
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        if (isToken0) {
            pool.reserve0 += amountIn;
            pool.reserve1 -= amountOut;
        } else {
            pool.reserve1 += amountIn;
            pool.reserve0 -= amountOut;
        }
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        return numerator / denominator;
    }

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) public pure returns (uint256) {
        require(amountA > 0, "Insufficient amount");
        require(reserveA > 0 && reserveB > 0, "Insufficient liquidity");
        return (amountA * reserveB) / reserveA;
    }

    function getPoolInfo(address token0, address token1) 
        external 
        view 
        returns (uint256 reserve0, uint256 reserve1, uint256 totalLiquidity) 
    {
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        Pool storage pool = pools[tokenA][tokenB];
        return (pool.reserve0, pool.reserve1, pool.totalLiquidity);
    }

    function getUserLiquidity(address user, address token0, address token1) 
        external 
        view 
        returns (uint256) 
    {
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        return pools[tokenA][tokenB].liquidity[user];
    }

    function setFeePercentage(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high");
        feePercentage = newFee;
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}