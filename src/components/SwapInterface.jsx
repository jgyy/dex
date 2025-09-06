import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function SwapInterface({ dexContract, tokenAContract, tokenBContract, account, setMessage }) {
  const [tokenIn, setTokenIn] = useState('tokenA');
  const [amountIn, setAmountIn] = useState('');
  const [estimatedOut, setEstimatedOut] = useState('0');

  useEffect(() => {
    if (amountIn && dexContract) {
      estimateOutput();
    }
  }, [amountIn, tokenIn]);

  const estimateOutput = async () => {
    try {
      const poolInfo = await dexContract.getPoolInfo(
        tokenAContract.address,
        tokenBContract.address
      );
      
      const isTokenA = tokenIn === 'tokenA';
      const reserveIn = isTokenA ? poolInfo.reserve0 : poolInfo.reserve1;
      const reserveOut = isTokenA ? poolInfo.reserve1 : poolInfo.reserve0;
      
      if (reserveIn.gt(0) && reserveOut.gt(0)) {
        const amountInWei = ethers.utils.parseEther(amountIn || '0');
        const amountInWithFee = amountInWei.mul(9970).div(10000);
        const amountOut = await dexContract.getAmountOut(amountInWithFee, reserveIn, reserveOut);
        setEstimatedOut(ethers.utils.formatEther(amountOut));
      }
    } catch (error) {
      console.error('Error estimating output:', error);
      setEstimatedOut('0');
    }
  };

  const handleSwap = async () => {
    if (!account || !dexContract || !amountIn) {
      setMessage({ type: 'error', text: 'Please connect wallet and enter amount' });
      return;
    }

    try {
      const amountInWei = ethers.utils.parseEther(amountIn);
      const minAmountOut = ethers.utils.parseEther((parseFloat(estimatedOut) * 0.95).toString());
      
      const tokenInContract = tokenIn === 'tokenA' ? tokenAContract : tokenBContract;
      const tokenOutAddress = tokenIn === 'tokenA' ? tokenBContract.address : tokenAContract.address;
      
      const allowance = await tokenInContract.allowance(account, dexContract.address);
      if (allowance.lt(amountInWei)) {
        setMessage({ type: '', text: 'Approving tokens...' });
        const approveTx = await tokenInContract.approve(dexContract.address, ethers.constants.MaxUint256);
        await approveTx.wait();
      }
      
      setMessage({ type: '', text: 'Swapping tokens...' });
      const swapTx = await dexContract.swap(
        tokenInContract.address,
        tokenOutAddress,
        amountInWei,
        minAmountOut
      );
      await swapTx.wait();
      
      setMessage({ type: 'success', text: 'Swap successful!' });
      setAmountIn('');
      setEstimatedOut('0');
    } catch (error) {
      console.error('Swap error:', error);
      setMessage({ type: 'error', text: 'Swap failed: ' + error.message });
    }
  };

  return (
    <div>
      <h2>Swap Tokens</h2>
      
      <div className="input-group">
        <label>From</label>
        <select value={tokenIn} onChange={(e) => setTokenIn(e.target.value)}>
          <option value="tokenA">Token A</option>
          <option value="tokenB">Token B</option>
        </select>
      </div>

      <div className="input-group">
        <label>Amount</label>
        <input
          type="number"
          placeholder="0.0"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
        />
      </div>

      <div className="input-group">
        <label>To (Estimated)</label>
        <input
          type="text"
          value={estimatedOut}
          readOnly
          placeholder="0.0"
        />
      </div>

      <button 
        className="action-btn" 
        onClick={handleSwap}
        disabled={!account || !amountIn || parseFloat(amountIn) <= 0}
      >
        {account ? 'Swap' : 'Connect Wallet'}
      </button>
    </div>
  );
}

export default SwapInterface;