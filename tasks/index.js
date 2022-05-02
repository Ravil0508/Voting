const deployedContractAddr = "0xb288299f8A26eb9eab8035d4c144156E02A492C9";

task("deploy", "Развертывает контракт в сети").setAction(async () => {
    const [deployer] = await ethers.getSigners();

    console.log("Развертывание контрактов с учетной записью:", deployer.address);
    console.log("Баланс счета:", (await deployer.getBalance()).toString());

    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.deploy();

    console.log(`Voting contract address: ${voting.address}`);
});

task("addVoting", "Creates a new voting")
    .addParam("name", "name of the vote")
    .setAction(async (args) => {
    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.attach(deployedContractAddr);
    const votingTransaction = await voting.addVoting(args['name']);
    const rc = await votingTransaction.wait();

    const votingCreatedEvent = rc.events.find(event => event.event === 'VotingCreated');
    const [_id] = votingCreatedEvent.args;

    console.log(`Your voting id: ${_id}`);
});

task("withDrawCommission", "Withdraws commission").setAction(async () => {
    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.attach(deployedContractAddr);
    const transaction = await voting.withDrawCommission();
    await transaction.wait();
    console.log('Commission successfully withdrawed');
});

task("vote", "Vote to a specific voting")
    .addParam("votingId", "Voting to vote id")
    .addParam("elected", "Address of candidate to vote")
    .setAction(async (args) => {
        const Voting = await ethers.getContractFactory("Voting");
        const voting = await Voting.attach(deployedContractAddr);
        const transaction = await voting.vote(args['votingId'], args['elected'], { value: ethers.utils.parseEther("0.01") });
        await transaction.wait();
        console.log(`Successfully voted`);
    });


task("finish", "Vote to the specific voting")
    .addParam("votingId", "Voting to vote id")
    .setAction(async (args) => {
        const Voting = await ethers.getContractFactory("Voting");
        const voting = await Voting.attach(deployedContractAddr);
        const transaction = await voting.finish(args['votingId']);
        await transaction.wait();
        console.log('Successfully closed');
    });


task("votingInfo", "Shows the information of a specific voting")
    .addParam("votingId", "Voting to vote id")
    .setAction(async (args) => {
        const Voting = await ethers.getContractFactory("Voting");
        const voting = await Voting.attach(deployedContractAddr);
        const response = await voting.votingInfo(args['votingId']);

        const nameVote = response[0];
        const endDate = new Date(response[1] * 1000);
        const isOpen = response[2];
        const leader = response[3];
        const numberVoters = response[4];

        console.log(`Voting info:\nname of the vote: ${response}\nDate end: ${endDate}\nIs open: ${isOpen}\nLeader: ${leader}\nNumber of voters: ${numberVoters}`);
    });