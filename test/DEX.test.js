const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
  let dex, tokenA, tokenB;
  let owner, user1, user2;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy tokens
    const Token = await ethers.getContractFactory("Token");
    tokenA = await Token.deploy("Token A", "TKNA", 1000000, 18);
    tokenB = await Token.deploy("Token B", "TKNB", 1000000, 18);

    // Deploy DEX
    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy();

    // Transfer some tokens to users
    await tokenA.transfer(user1.address, ethers.parseEther("10000"));
    await tokenB.transfer(user1.address, ethers.parseEther("10000"));
    await tokenA.transfer(user2.address, ethers.parseEther("10000"));
    await tokenB.transfer(user2.address, ethers.parseEther("10000"));
  });

  describe("Pool Creation", function () {
    it("Should create a new pool", async function () {
      await dex.createPool(tokenA.target, tokenB.target);
      expect(await dex.poolExists(tokenA.target, tokenB.target)).to.be.true;
    });

    it("Should not create duplicate pools", async function () {
      await dex.createPool(tokenA.target, tokenB.target);
      try {
        await dex.createPool(tokenA.target, tokenB.target);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Pool already exists");
      }
    });
  });

  describe("Liquidity Management", function () {
    beforeEach(async function () {
      await dex.createPool(tokenA.target, tokenB.target);
    });

    it("Should add liquidity to pool", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.connect(user1).approve(dex.target, amountA);
      await tokenB.connect(user1).approve(dex.target, amountB);

      await dex.connect(user1).addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB
      );

      const poolInfo = await dex.getPoolInfo(tokenA.target, tokenB.target);
      // Check reserves based on token ordering
      const [token0, token1] = tokenA.target.toLowerCase() < tokenB.target.toLowerCase() 
        ? [tokenA.target, tokenB.target] 
        : [tokenB.target, tokenA.target];
      const [expectedReserve0, expectedReserve1] = token0 === tokenA.target 
        ? [amountA, amountB] 
        : [amountB, amountA];
      expect(poolInfo.reserve0).to.equal(expectedReserve0);
      expect(poolInfo.reserve1).to.equal(expectedReserve1);
    });

    it("Should remove liquidity from pool", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.connect(user1).approve(dex.target, amountA);
      await tokenB.connect(user1).approve(dex.target, amountB);

      await dex.connect(user1).addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB
      );

      const userLiquidity = await dex.getUserLiquidity(
        user1.address,
        tokenA.target,
        tokenB.target
      );

      await dex.connect(user1).removeLiquidity(
        tokenA.target,
        tokenB.target,
        userLiquidity / 2n
      );

      const poolInfo = await dex.getPoolInfo(tokenA.target, tokenB.target);
      expect(poolInfo.reserve0).to.be.closeTo(amountA / 2n, ethers.parseEther("1"));
      expect(poolInfo.reserve1).to.be.closeTo(amountB / 2n, ethers.parseEther("1"));
    });
  });

  describe("Swapping", function () {
    beforeEach(async function () {
      await dex.createPool(tokenA.target, tokenB.target);
      
      // Add initial liquidity
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("2000");

      await tokenA.approve(dex.target, amountA);
      await tokenB.approve(dex.target, amountB);

      await dex.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB
      );
    });

    it("Should swap tokens correctly", async function () {
      const swapAmount = ethers.parseEther("10");
      
      await tokenA.connect(user1).approve(dex.target, swapAmount);
      
      const user1TokenBBefore = await tokenB.balanceOf(user1.address);
      
      await dex.connect(user1).swap(
        tokenA.target,
        tokenB.target,
        swapAmount,
        0
      );
      
      const user1TokenBAfter = await tokenB.balanceOf(user1.address);
      expect(user1TokenBAfter).to.be.greaterThan(user1TokenBBefore);
    });

    it("Should apply fees correctly", async function () {
      const swapAmount = ethers.parseEther("10");
      
      await tokenA.connect(user1).approve(dex.target, swapAmount);
      
      const poolInfoBefore = await dex.getPoolInfo(tokenA.target, tokenB.target);
      
      await dex.connect(user1).swap(
        tokenA.target,
        tokenB.target,
        swapAmount,
        0
      );
      
      const poolInfoAfter = await dex.getPoolInfo(tokenA.target, tokenB.target);
      
      // Pool should have more tokenA after swap
      expect(poolInfoAfter.reserve0).to.be.greaterThan(poolInfoBefore.reserve0);
      // Pool should have less tokenB after swap
      expect(poolInfoAfter.reserve1).to.be.lessThan(poolInfoBefore.reserve1);
    });
  });
});