import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { HeroNFT, HeroNFT__factory } from "../typechain-types";

describe("HeroNFT", function () {
  let HeroNFT: HeroNFT__factory;
  let heroNFT: HeroNFT;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    // Lấy factory và các tài khoản
    HeroNFT = await ethers.getContractFactory("HeroNFT") as HeroNFT__factory;
    [owner, addr1, addr2] = await ethers.getSigners();

    // Triển khai hợp đồng
    heroNFT = await HeroNFT.deploy();
    await heroNFT.waitForDeployment();
  });

  describe("Hero Creation", function () {
    it("Should create a random hero", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      const balance = await heroNFT.balanceOf(owner.address);
      expect(balance).to.equal(1);

      const hero = await heroNFT.heroes(tokenId);
      expect(hero.strength).to.be.gte(10).and.to.be.lte(100);
      expect(hero.agility).to.be.gte(10).and.to.be.lte(100);
      expect(hero.intelligence).to.be.gte(10).and.to.be.lte(100);
      expect(hero.rarity).to.be.oneOf([0, 1, 2, 3]); // Common, Rare, Legendary, Mythical
    });

    it("Should not allow minting beyond MAX_MINT_PER_WALLET", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      for (let i = 0; i < 10; i++) {
        await heroNFT.mintHero({ value: mintPrice });
      }
      await expect(heroNFT.mintHero({ value: mintPrice })).to.be.revertedWith(
        "Mint limit per wallet reached"
      );
    });
  });

  describe("Hero Transfer", function () {
    it("Should allow transferring a hero", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      // Phê duyệt và chuyển nhượng
      await heroNFT.approve(addr1.address, tokenId);
      await heroNFT.connect(addr1).transferFrom(owner.address, addr1.address, tokenId);

      // Kiểm tra chủ sở hữu mới
      const newOwner = await heroNFT.ownerOf(tokenId);
      expect(newOwner).to.equal(addr1.address);

      // Kiểm tra số lượng hero
      expect(await heroNFT.balanceOf(owner.address)).to.equal(0);
      expect(await heroNFT.balanceOf(addr1.address)).to.equal(1);
    });

    it("Should not allow unauthorized transfer", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      // Thử chuyển nhượng mà không phê duyệt
      await expect(
        heroNFT.connect(addr1).transferFrom(owner.address, addr1.address, tokenId)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });
  });

  describe("Hero Listing and Offering", function () {
    it("Should allow listing and offering a hero", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      // List hero
      const listPrice = ethers.parseEther("0.1");
      await heroNFT.listNFT(tokenId, listPrice);
      expect(await heroNFT.listedNFTs(tokenId)).to.equal(listPrice);

      // Offer hero
      const offerPrice = ethers.parseEther("0.05");
      await heroNFT.connect(addr1).offerNFT(tokenId, { value: offerPrice });
      expect(await heroNFT.offers(tokenId, addr1.address)).to.equal(offerPrice);
    });

    it("Should allow cancelling an offer", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      await heroNFT.listNFT(tokenId, ethers.parseEther("0.1"));
      const offerPrice = ethers.parseEther("0.05");
      await heroNFT.connect(addr1).offerNFT(tokenId, { value: offerPrice });

      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      await heroNFT.connect(addr1).cancelOffer(tokenId);
      const balanceAfter = await ethers.provider.getBalance(addr1.address);

      expect(await heroNFT.offers(tokenId, addr1.address)).to.equal(0);
      expect(balanceAfter).to.be.above(balanceBefore);
    });

    it("Should not allow offering an unlisted hero", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      await expect(
        heroNFT.connect(addr1).offerNFT(tokenId, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("NFT not listed");
    });
  });

  describe("Hero Offer Acceptance", function () {
    it("Should allow accepting an offer", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      await heroNFT.listNFT(tokenId, ethers.parseEther("0.1"));
      const offerPrice = ethers.parseEther("0.05");
      await heroNFT.connect(addr1).offerNFT(tokenId, { value: offerPrice });

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await heroNFT.acceptOffer(tokenId, addr1.address);
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(await heroNFT.ownerOf(tokenId)).to.equal(addr1.address);
      expect(await heroNFT.listedNFTs(tokenId)).to.equal(0);
      expect(ownerBalanceAfter).to.be.above(ownerBalanceBefore);
    });

    it("Should not allow accepting an offer from non-owner", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      await heroNFT.listNFT(tokenId, ethers.parseEther("0.1"));
      await heroNFT.connect(addr1).offerNFT(tokenId, { value: ethers.parseEther("0.05") });

      await expect(
        heroNFT.connect(addr2).acceptOffer(tokenId, addr1.address)
      ).to.be.revertedWith("Not the owner");
    });
  });

  describe("Hero Delisting", function () {
    it("Should allow delisting a hero", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      await heroNFT.listNFT(tokenId, ethers.parseEther("0.1"));
      await heroNFT.delistNFT(tokenId);
      expect(await heroNFT.listedNFTs(tokenId)).to.equal(0);
    });

    it("Should not allow delisting an unlisted hero", async function () {
      const mintPrice = await heroNFT.MINT_PRICE();
      const tx = await heroNFT.mintHero({ value: mintPrice });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed: no receipt");

      const tokenId = receipt.logs
        .map((log) => heroNFT.interface.parseLog(log))
        .find((log) => log?.name === "HeroMinted")?.args.tokenId;
      if (!tokenId) throw new Error("Failed to parse HeroMinted event");

      await expect(heroNFT.delistNFT(tokenId)).to.be.revertedWith("NFT not listed");
    });
  });
});