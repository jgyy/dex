import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function PoolInfo({ dexContract, tokenAAddress, tokenBAddress }) {
  const [poolData, setPoolData] = useState({
    reserve0: '0',
    reserve1: '0',
    totalLiquidity: '0',
    poolExists: false
  });

  useEffect(() => {
    if (dexContract) {
      fetchPoolInfo();
      const interval = setInterval(fetchPoolInfo, 5000);
      return () => clearInterval(interval);
    }
  }, [dexContract]);

  const fetchPoolInfo = async () => {
    try {
      const exists = await dexContract.poolExists(tokenAAddress, tokenBAddress);
      
      if (exists) {
        const info = await dexContract.getPoolInfo(tokenAAddress, tokenBAddress);
        setPoolData({
          reserve0: ethers.utils.formatEther(info.reserve0),
          reserve1: ethers.utils.formatEther(info.reserve1),
          totalLiquidity: ethers.utils.formatEther(info.totalLiquidity),
          poolExists: true
        });
      } else {
        setPoolData({
          reserve0: '0',
          reserve1: '0',
          totalLiquidity: '0',
          poolExists: false
        });
      }
    } catch (error) {
      console.error('Error fetching pool info:', error);
    }
  };

  return (
    <div>
      <h2>Pool Information</h2>
      
      {poolData.poolExists ? (
        <div className="pool-info">
          <h3>Token A / Token B Pool</h3>
          
          <div className="pool-stat">
            <span>Token A Reserve:</span>
            <span>{parseFloat(poolData.reserve0).toFixed(4)}</span>
          </div>
          
          <div className="pool-stat">
            <span>Token B Reserve:</span>
            <span>{parseFloat(poolData.reserve1).toFixed(4)}</span>
          </div>
          
          <div className="pool-stat">
            <span>Total Liquidity:</span>
            <span>{parseFloat(poolData.totalLiquidity).toFixed(4)}</span>
          </div>
          
          <div className="pool-stat">
            <span>Exchange Rate:</span>
            <span>
              1 Token A = {poolData.reserve0 > 0 ? 
                (parseFloat(poolData.reserve1) / parseFloat(poolData.reserve0)).toFixed(4) : 
                '0'} Token B
            </span>
          </div>
        </div>
      ) : (
        <div className="pool-info">
          <p>No pool exists yet. Add liquidity to create a pool.</p>
        </div>
      )}
    </div>
  );
}

export default PoolInfo;