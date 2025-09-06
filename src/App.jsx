import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import DEXAbi from './utils/DEX.json';
import TokenAbi from './utils/Token.json';
import SwapInterface from './components/SwapInterface';
import LiquidityInterface from './components/LiquidityInterface';
import PoolInfo from './components/PoolInfo';

const DEX_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const TOKEN_A_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const TOKEN_B_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

function App() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [dexContract, setDexContract] = useState(null);
  const [tokenAContract, setTokenAContract] = useState(null);
  const [tokenBContract, setTokenBContract] = useState(null);
  const [activeTab, setActiveTab] = useState('swap');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    initializeEthereumConnection();
  }, []);

  const initializeEthereumConnection = async () => {
    try {
      const ethereumProvider = await detectEthereumProvider();
      
      if (ethereumProvider) {
        const web3Provider = new ethers.providers.Web3Provider(ethereumProvider);
        setProvider(web3Provider);
        
        const accounts = await ethereumProvider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          handleAccountConnection(accounts[0], web3Provider);
        }
        
        ethereumProvider.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            handleAccountConnection(accounts[0], web3Provider);
          } else {
            resetConnection();
          }
        });
        
        ethereumProvider.on('chainChanged', () => {
          window.location.reload();
        });
      } else {
        setMessage({ type: 'error', text: 'Please install MetaMask!' });
      }
    } catch (error) {
      console.error('Error initializing Ethereum connection:', error);
      setMessage({ type: 'error', text: 'Failed to initialize connection' });
    }
  };

  const handleAccountConnection = async (account, web3Provider) => {
    setAccount(account);
    const web3Signer = web3Provider.getSigner();
    setSigner(web3Signer);
    
    const dex = new ethers.Contract(DEX_ADDRESS, DEXAbi, web3Signer);
    const tokenA = new ethers.Contract(TOKEN_A_ADDRESS, TokenAbi, web3Signer);
    const tokenB = new ethers.Contract(TOKEN_B_ADDRESS, TokenAbi, web3Signer);
    
    setDexContract(dex);
    setTokenAContract(tokenA);
    setTokenBContract(tokenB);
  };

  const resetConnection = () => {
    setAccount('');
    setSigner(null);
    setDexContract(null);
    setTokenAContract(null);
    setTokenBContract(null);
  };

  const connectWallet = async () => {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0 && provider) {
        handleAccountConnection(accounts[0], provider);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setMessage({ type: 'error', text: 'Failed to connect wallet' });
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Decentralized Exchange</h1>
        <div className="wallet-info">
          {account ? (
            <div className="connected">
              Connected: {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button className="connect-btn" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {message.text && (
        <div className={message.type === 'error' ? 'error' : 'success'}>
          {message.text}
        </div>
      )}

      <div className="main-content">
        <div className="card">
          <div className="tab-container">
            <button
              className={`tab ${activeTab === 'swap' ? 'active' : ''}`}
              onClick={() => setActiveTab('swap')}
            >
              Swap
            </button>
            <button
              className={`tab ${activeTab === 'liquidity' ? 'active' : ''}`}
              onClick={() => setActiveTab('liquidity')}
            >
              Liquidity
            </button>
          </div>

          {activeTab === 'swap' ? (
            <SwapInterface
              dexContract={dexContract}
              tokenAContract={tokenAContract}
              tokenBContract={tokenBContract}
              account={account}
              setMessage={setMessage}
            />
          ) : (
            <LiquidityInterface
              dexContract={dexContract}
              tokenAContract={tokenAContract}
              tokenBContract={tokenBContract}
              account={account}
              setMessage={setMessage}
            />
          )}
        </div>

        <div className="card">
          <PoolInfo
            dexContract={dexContract}
            tokenAAddress={TOKEN_A_ADDRESS}
            tokenBAddress={TOKEN_B_ADDRESS}
          />
        </div>
      </div>
    </div>
  );
}

export default App;