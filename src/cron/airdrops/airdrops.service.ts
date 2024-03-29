import { UTCDate } from '@date-fns/utc';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { differenceInDays, parseISO } from 'date-fns';
import { Response } from 'express';
import { AuthService } from 'src/auth/auth.service';

interface participant {
  walletAddress: string;
  telegramId: string;
  createdAt: Date;
  airdropName: string;
  airdropAchievedAt: Date;
  planActivatedAt: Date;
}

interface participantToCreate {
  id: number;
  walletAddress: string;
  telegramId: string;
  airdropName: string;
  createdAt: Date;
  planActivatedAt: Date;
  airdropAchievedAt: Date;
}

@Injectable()
export class AirdropsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authService: AuthService,
  ) {}

  async createAirdrop(airdropName: string, usersLimit: number) {
    await this.prisma.airdrops.create({
      data: {
        airdropName,
        usersLimit,
        currentProgress: 0,
      },
    });
  }

  async participateInAirdrop(
    walletAddress: string,
    airdropName: string,
    response: Response,
    participant: participantToCreate,
  ) {
    try {
      const checkAirdropRequirements =
        await this.checkAirdropRequirementsByParticipant(
          walletAddress,
          airdropName,
          response,
          participant,
        );

      return checkAirdropRequirements;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async checkParticipationInAirdrop(
    walletAddress: string,
    airdropName: string,
  ) {
    const participant = await this.prisma.airdropsParticipants.findFirst({
      where: {
        AND: [{ walletAddress }, { airdropName }],
      },
    });

    if (participant) {
      return participant;
    } else {
      return null;
    }
  }

  async checkAirdropRequirementsByParticipant(
    walletAddress: string,
    airdropName: string,
    response: Response,
    participant: participantToCreate,
  ) {
    const utcDate = new UTCDate();
    const currentDate = new Date(utcDate);

    const user = await this.prisma.users.findUnique({
      where: {
        walletAddress,
      },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const airdrop = await this.prisma.airdrops.findUnique({
      where: {
        airdropName,
      },
    });

    const currentProgress = await this.prisma.airdropsParticipants.findMany({
      where: {
        AND: [{ airdropName }, { airdropAchievedAt: { not: null } }],
      },
    });

    if (currentProgress.length >= airdrop.usersLimit) {
      if (airdrop.status !== 'completed') {
        await this.prisma.airdrops.update({
          where: {
            airdropName,
          },
          data: {
            currentProgress: currentProgress.length,
            status: 'completed',
          },
        });
      }
    }

    if (participant && airdrop.status === 'ongoing') {
      if (airdropName === 'airdrop1') {
        if (user.freeTrialWasTaken) {
          if (participant && participant.airdropAchievedAt === null) {
            participant = await this.prisma.airdropsParticipants.update({
              where: {
                walletAddress_airdropName: {
                  walletAddress,
                  airdropName,
                },
              },
              data: {
                planActivatedAt: utcDate,
                airdropAchievedAt: utcDate,
              },
            });
          }

          await this.prisma.airdrops.update({
            where: {
              airdropName,
            },
            data: {
              currentProgress: {
                increment: 1,
              },
            },
          });

          if (airdrop.usersLimit - airdrop.currentProgress === 1) {
            const airdropStatus = await this.prisma.airdrops.findUnique({
              where: {
                airdropName,
              },
            });

            if (
              airdropStatus &&
              airdropStatus.status !== 'completed' &&
              airdropStatus.currentProgress >= airdropStatus.usersLimit
            ) {
              await this.prisma.airdrops.update({
                where: {
                  airdropName,
                },
                data: {
                  status: 'completed',
                },
              });
            }
          }

          return {
            airdropName: airdropName,
            freeTrialWasTaken: user.freeTrialWasTaken,
            airdropAchievedAt: utcDate,
          };
        }

        return {
          airdropName: airdropName,
          freeTrialWasTaken: user.freeTrialWasTaken,
          airdropAchievedAt: null,
        };
      }

      if (airdropName === 'airdrop2') {
        if (user.subscriptionLevel === 'plan1') {
          const planIsActive = await this.authService.checkPlanIsActive(
            walletAddress,
            'plan1',
          );

          if (participant.planActivatedAt === null && planIsActive === true) {
            await this.prisma.airdropsParticipants.update({
              where: {
                walletAddress_airdropName: {
                  walletAddress,
                  airdropName,
                },
              },
              data: {
                planActivatedAt: utcDate,
              },
            });

            return {
              airdropName: airdropName,
              planIsActive: planIsActive,
              daysLeftTillCompletion: 30,
              airdropAchievedAt: null,
            };
          }

          if (participant.planActivatedAt !== null && planIsActive === false) {
            await this.prisma.airdropsParticipants.update({
              where: {
                walletAddress_airdropName: {
                  walletAddress,
                  airdropName,
                },
              },
              data: {
                planActivatedAt: null,
              },
            });

            return {
              airdropName: airdropName,
              planIsActive: planIsActive,
              daysLeftTillCompletion: 30,
              airdropAchievedAt: null,
            };
          }

          if (planIsActive && participant.planActivatedAt != null) {
            const planActivationDate = new Date(participant.planActivatedAt);
            const daysPassedTillCompletion = differenceInDays(
              parseISO(currentDate.toISOString()),
              parseISO(planActivationDate.toISOString()),
            );

            let daysLeftTillCompletion = 30 - daysPassedTillCompletion;

            if (daysLeftTillCompletion <= 0) {
              daysLeftTillCompletion = 0;

              await this.prisma.airdropsParticipants.update({
                where: {
                  walletAddress_airdropName: {
                    walletAddress,
                    airdropName,
                  },
                },
                data: {
                  airdropAchievedAt: utcDate,
                },
              });

              const airdrop = await this.prisma.airdrops.update({
                where: {
                  airdropName,
                },
                data: {
                  currentProgress: {
                    increment: 1,
                  },
                },
              });

              if (airdrop.usersLimit - airdrop.currentProgress === 1) {
                const airdropStatus = await this.prisma.airdrops.findUnique({
                  where: {
                    airdropName,
                  },
                });

                if (
                  airdropStatus &&
                  airdropStatus.status !== 'completed' &&
                  airdropStatus.currentProgress >= airdropStatus.usersLimit
                ) {
                  await this.prisma.airdrops.update({
                    where: {
                      airdropName,
                    },
                    data: {
                      status: 'completed',
                    },
                  });
                }
              }

              return {
                airdropName,
                planIsActive,
                daysLeftTillCompletion,
                airdropAchievedAt: utcDate,
              };
            }

            return {
              airdropName,
              planIsActive,
              daysLeftTillCompletion,
            };
          }
        }

        return {
          airdropName: airdropName,
          planIsActive: false,
          daysLeftTillCompletion: 30,
          airdropAchievedAt: null,
        };
      }
    }

    if (!participant) {
      if (airdropName === 'airdrop1') {
        return {
          airdropName: airdropName,
          freeTrialWasTaken: user.freeTrialWasTaken,
          airdropAchievedAt: null,
        };
      }

      if (airdropName === 'airdrop2') {
        return {
          airdropName: airdropName,
          planIsActive: false,
          daysLeftTillCompletion: 30,
          airdropAchievedAt: null,
        };
      }
    }

    if (participant && airdrop.status === 'completed') {
      if (airdropName === 'airdrop1') {
        return {
          airdropName: airdropName,
          freeTrialWasTaken: user.freeTrialWasTaken,
          airdropAchievedAt: participant.airdropAchievedAt,
        };
      }
      if (airdropName === 'airdrop2') {
        let planIsActive = false;
        if (participant.planActivatedAt) {
          planIsActive = true;
        }
        return {
          airdropName: airdropName,
          planIsActive,
          daysLeftTillCompletion: 30,
          airdropAchievedAt: participant.airdropAchievedAt,
        };
      }
    }

    throw new HttpException('Airdrop not found', HttpStatus.NOT_FOUND);
  }

  async checkAirdropRequirementsCron(airdropName: string) {
    try {
      const utcDate = new UTCDate();

      const airdrop = await this.prisma.airdrops.findUnique({
        where: {
          airdropName,
        },
      });

      const currentProgress = await this.prisma.airdropsParticipants.findMany({
        where: {
          AND: [{ airdropName }, { airdropAchievedAt: { not: null } }],
        },
      });

      if (currentProgress.length >= airdrop.usersLimit) {
        if (airdrop.status !== 'completed') {
          await this.prisma.airdrops.update({
            where: {
              airdropName,
            },
            data: {
              currentProgress: currentProgress.length,
              status: 'completed',
            },
          });
        }
      }

      if (airdrop && airdrop.status === 'ongoing') {
        const availableSpaceToParticipate =
          airdrop.usersLimit - airdrop.currentProgress;

        let newParticipantsCount = 0;

        const participants = await this.prisma.airdropsParticipants.findMany({
          where: {
            AND: [{ airdropAchievedAt: null }, { airdropName }],
          },
        });

        if (participants.length > 0) {
          const participantsWallets = participants.map(
            (participant) => participant.walletAddress,
          );

          const users = await this.prisma.users.findMany({
            where: {
              walletAddress: {
                in: participantsWallets,
              },
            },
          });

          const participantsToUpdate: participant[] = [];

          if (airdropName === 'airdrop1') {
            users.forEach(async (user) => {
              const currentParticipant = participants.find(
                (participant) =>
                  participant.walletAddress === user.walletAddress,
              );

              if (user.freeTrialWasTaken === true) {
                await participantsToUpdate.push({
                  walletAddress: user.walletAddress,
                  telegramId: user.telegramId,
                  createdAt: currentParticipant.createdAt,
                  airdropName: airdropName,
                  airdropAchievedAt: utcDate,
                  planActivatedAt: utcDate,
                });
                newParticipantsCount++;
                if (availableSpaceToParticipate <= newParticipantsCount) {
                  return;
                }
              } else {
                await participantsToUpdate.push({
                  walletAddress: user.walletAddress,
                  telegramId: user.telegramId,
                  createdAt: currentParticipant.createdAt,
                  airdropName: airdropName,
                  airdropAchievedAt: null,
                  planActivatedAt: null,
                });
              }
            });

            const participantsToRewrite = participantsToUpdate.map(
              (participant) => participant.walletAddress,
            );

            await this.prisma.airdropsParticipants.deleteMany({
              where: {
                AND: [
                  {
                    walletAddress: {
                      in: participantsToRewrite,
                    },
                  },
                  { airdropName },
                ],
              },
            });

            await this.prisma.airdropsParticipants.createMany({
              data: participantsToUpdate,
            });

            if (newParticipantsCount === availableSpaceToParticipate) {
              await this.prisma.airdrops.update({
                where: {
                  airdropName,
                },
                data: {
                  currentProgress: {
                    increment: newParticipantsCount,
                  },
                  status: 'completed',
                },
              });
            } else {
              await this.prisma.airdrops.update({
                where: {
                  airdropName,
                },
                data: {
                  currentProgress: {
                    increment: newParticipantsCount,
                  },
                },
              });
            }
          }

          if (airdropName === 'airdrop2') {
            users.forEach(async (user) => {
              const currentParticipant = participants.find(
                (participant) =>
                  participant.walletAddress === user.walletAddress,
              );

              if (user.subscriptionLevel === 'plan1') {
                const planIsActive = await this.authService.checkPlanIsActive(
                  user.walletAddress,
                  'plan1',
                );

                if (
                  planIsActive &&
                  currentParticipant.planActivatedAt === null
                ) {
                  await participantsToUpdate.push({
                    walletAddress: user.walletAddress,
                    telegramId: user.telegramId,
                    createdAt: currentParticipant.createdAt,
                    airdropName: airdropName,
                    airdropAchievedAt: null,
                    planActivatedAt: utcDate,
                  });
                }

                if (
                  planIsActive &&
                  currentParticipant.planActivatedAt !== null
                ) {
                  const currentDate = new Date(utcDate);
                  const planActivationDate = new Date(
                    currentParticipant.planActivatedAt,
                  );
                  const daysPassedTillCompletion = differenceInDays(
                    parseISO(currentDate.toISOString()),
                    parseISO(planActivationDate.toISOString()),
                  );

                  let daysLeftTillCompletion = 30 - daysPassedTillCompletion;

                  if (daysLeftTillCompletion <= 0) {
                    daysLeftTillCompletion = 0;

                    await participantsToUpdate.push({
                      walletAddress: user.walletAddress,
                      telegramId: user.telegramId,
                      createdAt: currentParticipant.createdAt,
                      airdropName: airdropName,
                      airdropAchievedAt: utcDate,
                      planActivatedAt: currentParticipant.planActivatedAt,
                    });

                    newParticipantsCount++;
                    if (availableSpaceToParticipate <= newParticipantsCount) {
                      return;
                    }
                  }
                }

                if (
                  !planIsActive &&
                  currentParticipant.planActivatedAt !== null
                ) {
                  await participantsToUpdate.push({
                    walletAddress: user.walletAddress,
                    telegramId: user.telegramId,
                    createdAt: currentParticipant.createdAt,
                    airdropName: airdropName,
                    airdropAchievedAt: null,
                    planActivatedAt: null,
                  });
                }
              }
            });

            const participantsToRewrite = participantsToUpdate.map(
              (participant) => participant.walletAddress,
            );

            await this.prisma.airdropsParticipants.deleteMany({
              where: {
                AND: [
                  {
                    walletAddress: {
                      in: participantsToRewrite,
                    },
                  },
                  { airdropName },
                ],
              },
            });

            await this.prisma.airdropsParticipants.createMany({
              data: participantsToUpdate,
            });

            if (newParticipantsCount === availableSpaceToParticipate) {
              await this.prisma.airdrops.update({
                where: {
                  airdropName,
                },
                data: {
                  currentProgress: {
                    increment: newParticipantsCount,
                  },
                  status: 'completed',
                },
              });
            } else {
              await this.prisma.airdrops.update({
                where: {
                  airdropName,
                },
                data: {
                  currentProgress: {
                    increment: newParticipantsCount,
                  },
                },
              });
            }
          }
        }
      }

      return;
    } catch (error) {
      return error;
    }
  }
}
