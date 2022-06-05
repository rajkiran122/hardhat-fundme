const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", () => {
          let fundMe, deployer, mockV3Aggregator, accounts
          const sendValue = ethers.utils.parseEther("1")
          beforeEach(async () => {
              // deploy our FundMe contract using hardhat-deploy
              deployer = (await getNamedAccounts()).deployer
              accounts = await ethers.getSigners()
              // inside the fixture we pass an array consisting of the tags we want to run
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })

          describe("constructor", async () => {
              it("should set the aggregator addresses correctly", async () => {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
          })

          describe("fund", async () => {
              it("should FAIL if you don't send enough ETH", async () => {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  )
              })

              it("should update the amount funded data structure", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })

              it("should add funder to array of s_funders", async () => {
                  await fundMe.fund({ value: sendValue })
                  const funder = await fundMe.getFunder(0)
                  assert.equal(funder, deployer)
              })
          })

          describe("withdraw", async () => {
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })

              it("should withdraw ETH from a single funder", async () => {
                  //Arrange
                  const startingFundMeBalance =
                      await ethers.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await ethers.provider.getBalance(deployer)

                  //Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await ethers.provider.getBalance(deployer)

                  //Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  )
              })

              it("should withdraw ETH from multiple funders", async () => {
                  //Arrange
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedAccount = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedAccount.fund({ value: sendValue })
                  }

                  const startingFundMeBalance =
                      await ethers.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await ethers.provider.getBalance(deployer)

                  //Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await ethers.provider.getBalance(deployer)

                  //Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  )

                  //Make sure that the getFunder are reset properly
                  await expect(fundMe.getFunder(1)).to.be.reverted

                  for (i = 0; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })

              it("Cheaper Withdraw", async () => {
                  //Arrange
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedAccount = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedAccount.fund({ value: sendValue })
                  }

                  const startingFundMeBalance =
                      await ethers.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await ethers.provider.getBalance(deployer)

                  //Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await ethers.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await ethers.provider.getBalance(deployer)

                  //Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  )

                  //Make sure that the funders are reset properly
                  await expect(fundMe.getFunder(1)).to.be.reverted

                  for (i = 0; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })

              it("should NOT be able to withdraw except the owner", async () => {
                  const attacker = accounts[4]
                  await expect(
                      fundMe.connect(attacker).withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })
      })
