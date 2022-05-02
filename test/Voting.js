const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingContract", function () {
    let VotingContract;
    let votingContract;
    let votingId;
    let owner;
    let user1;
    let user2;
    let users;

    beforeEach(async function () {
        VotingContract = await ethers.getContractFactory("Voting");
        [owner, user1, user2, ...users] = await ethers.getSigners();
        votingContract = await VotingContract.deploy();
        const votingTransaction = await votingContract.addVoting("Elections");
        const rc = await votingTransaction.wait();

        const votingCreatedEvent = rc.events.find(event => event.event === 'VotingCreated');
        [votingId] = votingCreatedEvent.args;

    })

    describe("Voting", function () {

        it("Проверка владельца", async function () {
            expect(await votingContract.owner()).to.equal(owner.address)
        })

        it("Проверка уникальности idVoting", async function () {
            const voting2Transaction = await votingContract.addVoting("Elections2");
            const rc2 = await voting2Transaction.wait();
    
            const voting2CreatedEvent = rc2.events.find(event => event.event === 'VotingCreated');
            const [voting2Id] = voting2CreatedEvent.args;
            expect(voting2Id).to.equal(1);
        });
    });

    describe("addVoting", async function () {

        it("Только владелец может создать новое голосование", async function () {
            await expect(votingContract.connect(user1).addVoting("Elections")).to.be.revertedWith("Only owner!");
        });

        it("Проверка инициализированного состояния", async function () {

            expect(votingId).to.equal(0);
            var response = await votingContract.votingInfo(votingId);
            expect(response[0]).to.equal("Elections");
            expect(response[2]).to.equal(true);
        });
    });

    describe("vote", async function () {

        it("Нельзя проголосовать без оплаты", async function () {
            await expect(votingContract.connect(user1).vote(votingId, user2.address)).to.be.revertedWith("Pay 0.01 ether to participate!");
        });

        it("Голосование после закрытия", async function () {
            await votingContract.connect(user1).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });
            await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]);
            await votingContract.finish(votingId);
            await expect(votingContract.connect(user2).vote(votingId, user1.address), { value: ethers.utils.parseEther("0.01") }).to.be.revertedWith("Voting is over!");

        });

        it("Нельзя проголосовать повторно", async function () {
            await votingContract.connect(user1).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });
            await expect(votingContract.connect(user1).vote(votingId, user1.address, { value: ethers.utils.parseEther("0.01") })).to.be.revertedWith("You have already cast your vote!");
        })

        it("Проверка состояния после голосования", async function () {
            await votingContract.connect(user1).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });

            expect(votingId).to.equal(0);
            var response = await votingContract.votingInfo(votingId);
            expect(response[0]).to.equal("Elections");
            expect(response[2]).to.equal(true);
            expect(response[3]).to.equal(user2.address);
            expect(response[4]).to.equal(1);
        });

        it("Проверка корректности подсчета голосов", async function () {

            for (let i = 0; i < 3; i++) {
                await votingContract.connect(users[i]).vote(votingId, user1.address, { value: ethers.utils.parseEther("0.01") });
            }

            for (let i = 3; i < 9; i++) {
                await votingContract.connect(users[i]).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });
            }

            for (let i = 9; i < 12; i++) {
                await votingContract.connect(users[i]).vote(votingId, owner.address, { value: ethers.utils.parseEther("0.01") });
            }
            var response = await votingContract.votingInfo(votingId);
            expect(response[3]).to.equal(user2.address);
            expect(response[4]).to.equal(12);

        });
    });

    describe("finish", async function () {

        it("Закрытие голосования раньше положенного", async function () {
            await expect(votingContract.finish(votingId)).to.be.revertedWith("Less than three days have passed!");
        });

        it("Закрытие голосования по прошествии положенного срока", async function () {
            await votingContract.connect(user1).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });

            await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]);

            var response = await votingContract.votingInfo(votingId);
            expect(response[2]).to.equal(true);

            const leaderInitialBalance = await user2.getBalance();

            await votingContract.finish(votingId);

            expect(await user2.getBalance() > leaderInitialBalance);
            var response = await votingContract.votingInfo(votingId);
            expect(await response[2]).to.equal(false);

        });

        it("Повторное закрытие голосования", async function () {
            await votingContract.connect(user1).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });
            await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]);
            await votingContract.finish(votingId);

            expect(votingContract.finish(votingId)).to.be.revertedWith("The voting is already closed!");
        });
    });

    describe("withDrawCommission", async function() {

        it("Вывод комиссии не владельцем", async function () {
        await expect(votingContract.connect(user1).withDrawCommission()).to.be.revertedWith("Only owner!");
        });

        it("Вывод комиссии владельцем и корректность суммы комиссии", async function () {
            const owner_initial_balance = await owner.getBalance();

            await votingContract.connect(user1).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });

            await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]);
            await votingContract.finish(votingId);

            await votingContract.withDrawCommission();

            expect(await owner.getBalance() > owner_initial_balance);
            expect(await owner.getBalance() - owner_initial_balance == 0.001);
        });
    });

    describe("votingInfo", async function() {

        it("Вывод информации о голосовании", async function () {
        await votingContract.connect(user1).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });
        await votingContract.connect(user2).vote(votingId, user2.address, { value: ethers.utils.parseEther("0.01") });
        var response = await votingContract.votingInfo(votingId);
        expect(await response[0]).to.equal("Elections");
        expect(await response[2]).to.equal(true);
        expect(await response[3]).to.equal(user2.address);
        expect(await response[4]).to.equal(2);
        });
    });

});