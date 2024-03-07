import { UTCDate } from '@date-fns/utc';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { differenceInDays, parseISO } from 'date-fns';
import { Response } from 'express';
import { AuthService } from 'src/auth/auth.service';

interface participant {
  walletAddress: string;
  telegramId: number;
  createdAt: Date;
  airdropName: string;
  airdropAchievedAt: Date;
  planActivatedAt: Date;
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
  ) {
    try {
      const checkAirdropRequirements =
        await this.checkAirdropRequirementsByParticipant(
          walletAddress,
          airdropName,
          response,
          true,
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
    submittingForParticipation?: boolean,
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

    if (
      airdrop &&
      airdrop.status === 'completed' &&
      airdrop.currentProgress >= airdrop.usersLimit
    ) {
      throw new HttpException(
        'Airdrop is already completed',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      airdrop &&
      airdrop.status !== 'completed' &&
      airdrop.currentProgress >= airdrop.usersLimit
    ) {
      await this.prisma.airdrops.update({
        where: {
          airdropName,
        },
        data: {
          status: 'completed',
        },
      });

      throw new HttpException(
        'Airdrop is already completed',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (airdropName === 'airdrop1') {
      if (user.freeTrialWasTaken) {
        let participant = await this.prisma.airdropsParticipants.upsert({
          where: {
            walletAddress_airdropName: {
              walletAddress,
              airdropName,
            },
          },
          update: {},
          create: {
            walletAddress,
            airdropName,
            planActivatedAt: utcDate,
            airdropAchievedAt: utcDate,
          },
        });

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

      const participant = await this.prisma.airdropsParticipants.upsert({
        where: {
          walletAddress_airdropName: {
            walletAddress,
            airdropName,
          },
        },
        update: {},
        create: {
          walletAddress,
          airdropName,
        },
      });

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

        if (submittingForParticipation === true && planIsActive === true) {
          const participant = await this.prisma.airdropsParticipants.create({
            data: {
              walletAddress,
              airdropName,
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

        if (submittingForParticipation === true && planIsActive === false) {
          const participant = await this.prisma.airdropsParticipants.create({
            data: {
              walletAddress,
              airdropName,
            },
          });

          return {
            airdropName: airdropName,
            planIsActive: planIsActive,
            daysLeftTillCompletion: 30,
            airdropAchievedAt: null,
          };
        }

        if (!submittingForParticipation) {
          const participant = await this.prisma.airdropsParticipants.findUnique(
            {
              where: {
                walletAddress_airdropName: {
                  walletAddress,
                  airdropName,
                },
              },
            },
          );

          if (participant) {
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

            if (planIsActive && participant.planActivatedAt === null) {
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
                airdropName,
                planIsActive,
                daysLeftTillCompletion: 30,
              };
            }

            if (!planIsActive && participant.planActivatedAt !== null) {
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
                airdropName,
                planIsActive,
                daysLeftTillCompletion: 30,
              };
            }
          }
        }
      }

      await this.prisma.airdropsParticipants.upsert({
        where: {
          walletAddress_airdropName: {
            walletAddress,
            airdropName,
          },
        },
        update: {},
        create: {
          walletAddress,
          airdropName,
        },
      });

      return {
        airdropName: airdropName,
        planIsActive: false,
        daysLeftTillCompletion: 30,
        airdropAchievedAt: null,
      };
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

      if (airdrop && airdrop.usersLimit - airdrop.currentProgress > 0) {
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
