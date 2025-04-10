import { ethers } from "hardhat";

async function main() {
  // Lấy ContractFactory cho HeroNFT
  const HeroNFT = await ethers.getContractFactory("HeroNFT");

  // Deploy contract
  const heroNFT = await HeroNFT.deploy();
  await heroNFT.waitForDeployment();

  // In địa chỉ contract sau khi deploy
  const contractAddress = await heroNFT.getAddress();
  console.log("HeroNFT deployed to:", contractAddress);
}

// Chạy script và xử lý lỗi
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });