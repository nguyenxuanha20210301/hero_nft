// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HeroNFT is ERC721, Ownable {
    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant COMMON_LIMIT = 600;
    uint256 public constant RARE_LIMIT = 300;
    uint256 public constant LEGENDARY_LIMIT = 90;
    uint256 public constant MYTHICAL_LIMIT = 10;
    uint256 public constant MINT_PRICE = 0.001 ether;
    uint256 public constant MAX_MINT_PER_WALLET = 10;

    uint256 private _tokenIdCounter;
    uint256 public commonCount;
    uint256 public rareCount;
    uint256 public legendaryCount;
    uint256 public mythicalCount;

    mapping(address => uint256) public mintedPerWallet; // Số NFT đã mint theo ví
    mapping(uint256 => uint256) public listedNFTs; // Giá niêm yết của NFT
    mapping(uint256 => mapping(address => uint256)) public offers; // Lời đề nghị mua theo tokenId và người mua

    struct Hero {
        uint256 strength;
        uint256 agility;
        uint256 intelligence;
        Rarity rarity;
    }

    enum Rarity { Common, Rare, Legendary, Mythical }
    mapping(uint256 => Hero) public heroes;

    event HeroMinted(address indexed to, uint256 indexed tokenId, Rarity rarity);
    event NFTListed(address indexed seller, uint256 indexed tokenId, uint256 price);
    event NFTDelisted(address indexed seller, uint256 indexed tokenId);
    event NFTOffered(address indexed buyer, uint256 indexed tokenId, uint256 price);
    event OfferAccepted(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price);
    event OfferCancelled(address indexed buyer, uint256 indexed tokenId, uint256 amount);

    constructor() ERC721("HeroNFT", "HERO") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    // Mint NFT
    function mintHero() public payable returns (uint256) {
        require(msg.value >= MINT_PRICE, "Not enough ETH sent");
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        require(mintedPerWallet[msg.sender] < MAX_MINT_PER_WALLET, "Mint limit per wallet reached");

        _tokenIdCounter += 1;
        uint256 newTokenId = _tokenIdCounter;

        Rarity rarity = _getRandomRarity();
        require(_canMintRarity(rarity), "Rarity limit reached");

        if (rarity == Rarity.Common) commonCount++;
        else if (rarity == Rarity.Rare) rareCount++;
        else if (rarity == Rarity.Legendary) legendaryCount++;
        else if (rarity == Rarity.Mythical) mythicalCount++;

        mintedPerWallet[msg.sender]++;

        uint256 strength = _randomInRange(10, 100);
        uint256 agility = _randomInRange(10, 100);
        uint256 intelligence = _randomInRange(10, 100);

        heroes[newTokenId] = Hero(strength, agility, intelligence, rarity);
        _safeMint(msg.sender, newTokenId);

        emit HeroMinted(msg.sender, newTokenId, rarity);
        return newTokenId;
    }

    // List NFT để bán
    function listNFT(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than 0");
        require(listedNFTs[tokenId] == 0, "NFT already listed");

        listedNFTs[tokenId] = price;
        approve(address(this), tokenId); // Approve contract để chuyển NFT khi accept

        emit NFTListed(msg.sender, tokenId, price);
    }

    // Hủy list NFT
    function delistNFT(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(listedNFTs[tokenId] > 0, "NFT not listed");

        listedNFTs[tokenId] = 0;
        approve(address(0), tokenId); // Xóa approval

        emit NFTDelisted(msg.sender, tokenId);
    }

    // Đặt offer để mua NFT
    function offerNFT(uint256 tokenId) external payable {
        require(ownerOf(tokenId) != msg.sender, "Cannot offer to buy your own NFT");
        require(msg.value > 0, "Offer price must be greater than 0");
        require(ownerOf(tokenId) != address(0), "NFT does not exist");
        require(listedNFTs[tokenId] > 0, "NFT not listed"); // Chỉ cho phép offer khi NFT đang được list

        // Nếu đã có offer trước đó, hủy và hoàn tiền offer cũ
        if (offers[tokenId][msg.sender] > 0) {
            uint256 oldOffer = offers[tokenId][msg.sender];
            offers[tokenId][msg.sender] = 0;
            payable(msg.sender).transfer(oldOffer);
            emit OfferCancelled(msg.sender, tokenId, oldOffer);
        }

        offers[tokenId][msg.sender] = msg.value;
        emit NFTOffered(msg.sender, tokenId, msg.value);
    }

    // Chấp nhận offer từ một người mua
    function acceptOffer(uint256 tokenId, address buyer) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        uint256 offerPrice = offers[tokenId][buyer];
        require(offerPrice > 0, "No offer from this buyer");
        require(listedNFTs[tokenId] > 0, "NFT not listed");

        offers[tokenId][buyer] = 0; // Xóa offer của người mua
        listedNFTs[tokenId] = 0; // Hủy list NFT

        safeTransferFrom(msg.sender, buyer, tokenId); // Chuyển NFT cho người mua
        payable(msg.sender).transfer(offerPrice); // Chuyển tiền cho người bán

        emit OfferAccepted(msg.sender, buyer, tokenId, offerPrice);
    }

    // Hủy offer và lấy lại tiền
    function cancelOffer(uint256 tokenId) external {
        uint256 offerPrice = offers[tokenId][msg.sender];
        require(offerPrice > 0, "No offer to cancel");

        offers[tokenId][msg.sender] = 0; // Xóa offer
        payable(msg.sender).transfer(offerPrice); // Hoàn tiền

        emit OfferCancelled(msg.sender, tokenId, offerPrice);
    }

    // Hàm hỗ trợ tạo độ ngẫu nhiên
    function _getRandomRarity() internal view returns (Rarity) {
        uint256 rand = _random() % 100;
        if (rand < 600) return Rarity.Common;
        else if (rand < 900) return Rarity.Rare;
        else if (rand < 990) return Rarity.Legendary;
        else return Rarity.Mythical;
    }

    function _canMintRarity(Rarity rarity) internal view returns (bool) {
        if (rarity == Rarity.Common && commonCount >= COMMON_LIMIT) return false;
        if (rarity == Rarity.Rare && rareCount >= RARE_LIMIT) return false;
        if (rarity == Rarity.Legendary && legendaryCount >= LEGENDARY_LIMIT) return false;
        if (rarity == Rarity.Mythical && mythicalCount >= MYTHICAL_LIMIT) return false;
        return true;
    }

    function _random() internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)));
    }

    function _randomInRange(uint256 min, uint256 max) internal view returns (uint256) {
        return min + (_random() % (max - min + 1));
    }

    // Rút tiền từ contract (chỉ owner)
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
}