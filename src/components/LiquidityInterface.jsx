import React, { useState } from 'react';
import { ethers } from 'ethers';

function LiquidityInterface({ dexContract, tokenAContract, tokenBContract, account, setMessage }) {
  const [action, setAction] = useState('add');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [liquidityAmount, setLiquidityAmount] = useState('');

  const handleAddLiquidity = async () => {
    if (!account || !dexContract || !amountA || !amountB) {
      setMessage({ type: 'error', text: 'Please fill all fields' });
      return;
    }

    try {
      const amountAWei = ethers.utils.parseEther(amountA);
      const amountBWei = ethers.utils.parseEther(amountB);
      
      const allowanceA = await tokenAContract.allowance(account, dexContract.address);
      if (allowanceA.lt(amountAWei)) {
        setMessage({ type: '', text: 'Approving Token A...' });
        const approveTxA = await tokenAContract.approve(dexContract.address, ethers.constants.MaxUint256);
        await approveTxA.wait();
      }
      
      const allowanceB = await tokenBContract.allowance(account, dexContract.address);
      if (allowanceB.lt(amountBWei)) {
        setMessage({ type: '', text: 'Approving Token B...' });
        const approveTxB = await tokenBContract.approve(dexContract.address, ethers.constants.MaxUint256);
        await approveTxB.wait();
      }
      
      const poolExists = await dexContract.poolExists(tokenAContract.address, tokenBContract.address);
      if (!poolExists) {
        setMessage({ type: '', text: 'Creating pool...' });
        const createTx = await dexContract.createPool(tokenAContract.address, tokenBContract.address);
        await createTx.wait();
      }
      
      setMessage({ type: '', text: 'Adding liquidity...' });
      const addTx = await dexContract.addLiquidity(
        tokenAContract.address,
        tokenBContract.address,
        amountAWei,
        amountBWei
      );
      await addTx.wait();
      
      setMessage({ type: 'success', text: 'Liquidity added successfully!' });
      setAmountA('');
      setAmountB('');
    } catch (error) {
      console.error('Add liquidity error:', error);
      setMessage({ type: 'error', text: 'Failed to add liquidity: ' + error.message });
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!account || !dexContract || !liquidityAmount) {
      setMessage({ type: 'error', text: 'Please enter liquidity amount' });
      return;
    }

    try {
      const liquidityWei = ethers.utils.parseEther(liquidityAmount);
      
      setMessage({ type: '', text: 'Removing liquidity...' });
      const removeTx = await dexContract.removeLiquidity(
        tokenAContract.address,
        tokenBContract.address,
        liquidityWei
      );
      await removeTx.wait();
      
      setMessage({ type: 'success', text: 'Liquidity removed successfully!' });
      setLiquidityAmount('');
    } catch (error) {
      console.error('Remove liquidity error:', error);
      setMessage({ type: 'error', text: 'Failed to remove liquidity: ' + error.message });
    }
  };

  return (
    <div>
      <h2>Manage Liquidity</h2>
      
      <div className="tab-container">
        <button
          className={`tab ${action === 'add' ? 'active' : ''}`}
          onClick={() => setAction('add')}
        >
          Add
        </button>
        <button
          className={`tab ${action === 'remove' ? 'active' : ''}`}
          onClick={() => setAction('remove')}
        >
          Remove
        </button>
      </div>

      {action === 'add' ? (
        <>
          <div className="input-group">
            <label>Token A Amount</label>
            <input
              type="number"
              placeholder="0.0"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Token B Amount</label>
            <input
              type="number"
              placeholder="0.0"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
            />
          </div>

          <button 
            className="action-btn" 
            onClick={handleAddLiquidity}
            disabled={!account || !amountA || !amountB}
          >
            Add Liquidity
          </button>
        </>
      ) : (
        <>
          <div className="input-group">
            <label>Liquidity Amount</label>
            <input
              type="number"
              placeholder="0.0"
              value={liquidityAmount}
              onChange={(e) => setLiquidityAmount(e.target.value)}
            />
          </div>

          <button 
            className="action-btn" 
            onClick={handleRemoveLiquidity}
            disabled={!account || !liquidityAmount}
          >
            Remove Liquidity
          </button>
        </>
      )}
    </div>
  );
}

export default LiquidityInterface;