// Global test function declarations
declare const describe: (
  description: string,
  specDefinitions: () => void
) => void;
declare const beforeEach: (action: () => void) => void;
declare const it: (description: string, action: () => void) => void;

// Module declarations
declare module "chai" {
  export const expect: any;
}

declare module "hardhat" {
  export const ethers: any;
}

declare module "@nomiclabs/hardhat-ethers/signers" {
  export interface SignerWithAddress {}
}
