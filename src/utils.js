import { Contract } from "@ethersproject/contracts";
import fs from "fs";
import fetch from "node-fetch";
import { basename, extname } from "path";

import baseStrategyAbi from "./contracts/BaseStrategy.json";
import controllerAbi from "./contracts/Controller.json";
import settV4Abi from "./contracts/SettV4.json";

export const getFileName = (fpath) => basename(fpath, extname(fpath));

export const writeJson = (fpath, obj) => {
  fs.writeFile(fpath, JSON.stringify(obj, null, 2), (err) => {
    if (err) throw err;
  });
};

class HTTPResponseError extends Error {
  constructor(response, ...args) {
    super(
      `HTTP Error Response: ${response.status} ${response.statusText}`,
      ...args
    );
    this.response = response;
  }
}

const checkStatus = (response) => {
  if (response.ok) {
    // response.status >= 200 && response.status < 300
    return response;
  } else {
    throw new HTTPResponseError(response);
  }
};

export const getTransactions = async (address, startBlock = 0) => {
  const endpoint = "https://api.etherscan.io/api";
  const token = process.env.ETHERSCAN_TOKEN;
  const response = await fetch(
    `${endpoint}?module=account&action=txlist&sort=desc&address=${address}&startblock=${startBlock}&apikey=${token}`
  );

  try {
    checkStatus(response);
  } catch (error) {
    console.error(error);
    const errorBody = await error.response.text();
    console.error(`Error body: ${errorBody}`);
  }

  const data = await response.json();
  return data.result;
};

export const getStrategyMetadata = async (strategy, provider) => {
  const strategyContract = new Contract(strategy, baseStrategyAbi, provider);
  const controllerContract = new Contract(
    await strategyContract.controller(),
    controllerAbi,
    provider
  );
  const want = await strategyContract.want();
  const vaultContract = new Contract(
    await controllerContract.vaults(want),
    settV4Abi,
    provider
  );
  const nameFull = await strategyContract.getName();
  const vaultNameFull = await vaultContract.name();
  return {
    name: nameFull.replace("Strategy", ""),
    nameFull,
    vaultName: vaultNameFull.replace("Badger Sett ", ""),
    vaultNameFull,
    vault: vaultContract.address,
    want,
  };
};

export const formatMs = (ms) => {
  const s = 1000;
  const m = s * 60;
  const h = m * 60;
  const d = h * 24;
  const msAbs = Math.abs(ms);
  if (msAbs >= 3 * d) {
    // Show days if more than 3 days
    return Math.round(ms / d) + "d";
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + "h";
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + "m";
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + "s";
  }
  return ms + "ms";
};
