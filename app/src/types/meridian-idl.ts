export const MeridianIDL = {
    "address": "G6sHax1H3nXc5gu8YzPmgntbQR5e1CWMqYg1ekZmjDTd",
    "metadata": {
      "name": "meridian",
      "version": "0.1.0",
      "spec": "0.1.0",
      "description": "Created with Anchor"
    },
    "instructions": [
      {
        "name": "execute_proposal",
        "docs": [
          "Execute an approved proposal by sending a Wormhole message"
        ],
        "discriminator": [
          186,
          60,
          116,
          133,
          108,
          128,
          111,
          28
        ],
        "accounts": [
          {
            "name": "payer",
            "writable": true,
            "signer": true
          },
          {
            "name": "config",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    99,
                    111,
                    110,
                    102,
                    105,
                    103
                  ]
                }
              ]
            }
          },
          {
            "name": "proposal",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    112,
                    114,
                    111,
                    112,
                    111,
                    115,
                    97,
                    108
                  ]
                },
                {
                  "kind": "account",
                  "path": "proposal.multisig",
                  "account": "CrossChainProposal"
                },
                {
                  "kind": "account",
                  "path": "proposal.transaction_index",
                  "account": "CrossChainProposal"
                }
              ]
            }
          },
          {
            "name": "multisig"
          },
          {
            "name": "squads_proposal"
          },
          {
            "name": "wormhole_program"
          },
          {
            "name": "wormhole_bridge"
          },
          {
            "name": "wormhole_message",
            "writable": true
          },
          {
            "name": "wormhole_sequence",
            "writable": true
          },
          {
            "name": "wormhole_fee_collector",
            "writable": true
          },
          {
            "name": "emitter",
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    101,
                    109,
                    105,
                    116,
                    116,
                    101,
                    114
                  ]
                }
              ]
            }
          },
          {
            "name": "system_program",
            "address": "11111111111111111111111111111111"
          },
          {
            "name": "clock",
            "address": "SysvarC1ock11111111111111111111111111111111"
          },
          {
            "name": "rent",
            "address": "SysvarRent111111111111111111111111111111111"
          }
        ],
        "args": []
      },
      {
        "name": "initialize",
        "docs": [
          "Initialize the Meridian program with a Squads multisig as authority"
        ],
        "discriminator": [
          175,
          175,
          109,
          31,
          13,
          152,
          155,
          237
        ],
        "accounts": [
          {
            "name": "authority",
            "writable": true,
            "signer": true
          },
          {
            "name": "config",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    99,
                    111,
                    110,
                    102,
                    105,
                    103
                  ]
                }
              ]
            }
          },
          {
            "name": "authorized_multisig",
            "docs": [
              "The authorized Squads multisig PDA"
            ]
          },
          {
            "name": "wormhole_program",
            "docs": [
              "The Wormhole program"
            ]
          },
          {
            "name": "wormhole_bridge",
            "docs": [
              "The Wormhole bridge"
            ]
          },
          {
            "name": "wormhole_fee_collector",
            "docs": [
              "The Wormhole fee collector"
            ]
          },
          {
            "name": "emitter",
            "docs": [
              "The emitter PDA for sending Wormhole messages"
            ],
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    101,
                    109,
                    105,
                    116,
                    116,
                    101,
                    114
                  ]
                }
              ]
            }
          },
          {
            "name": "system_program",
            "address": "11111111111111111111111111111111"
          },
          {
            "name": "rent",
            "address": "SysvarRent111111111111111111111111111111111"
          }
        ],
        "args": []
      },
      {
        "name": "propose_transaction",
        "docs": [
          "Propose a cross-chain transaction to be executed on an EVM chain"
        ],
        "discriminator": [
          35,
          204,
          169,
          240,
          74,
          70,
          31,
          236
        ],
        "accounts": [
          {
            "name": "payer",
            "writable": true,
            "signer": true
          },
          {
            "name": "config",
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    99,
                    111,
                    110,
                    102,
                    105,
                    103
                  ]
                }
              ]
            }
          },
          {
            "name": "multisig"
          },
          {
            "name": "transaction"
          },
          {
            "name": "proposal",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    112,
                    114,
                    111,
                    112,
                    111,
                    115,
                    97,
                    108
                  ]
                },
                {
                  "kind": "account",
                  "path": "multisig"
                },
                {
                  "kind": "arg",
                  "path": "transaction_index"
                }
              ]
            }
          },
          {
            "name": "system_program",
            "address": "11111111111111111111111111111111"
          },
          {
            "name": "rent",
            "address": "SysvarRent111111111111111111111111111111111"
          }
        ],
        "args": [
          {
            "name": "transaction_index",
            "type": "u64"
          },
          {
            "name": "target_chain",
            "type": "u16"
          },
          {
            "name": "target_address",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "call_data",
            "type": "bytes"
          },
          {
            "name": "gas_limit",
            "type": "u64"
          }
        ]
      }
    ],
    "accounts": [
      {
        "name": "CrossChainProposal",
        "discriminator": [
          237,
          244,
          102,
          115,
          222,
          254,
          198,
          163
        ]
      },
      {
        "name": "MeridianConfig",
        "discriminator": [
          188,
          16,
          35,
          87,
          172,
          21,
          211,
          200
        ]
      }
    ],
    "errors": [
      {
        "code": 6000,
        "name": "UnauthorizedMultisig",
        "msg": "The multisig is not authorized to use this program"
      },
      {
        "code": 6001,
        "name": "ProposalNotPending",
        "msg": "The proposal is not in a pending state"
      },
      {
        "code": 6002,
        "name": "ProposalNotApproved",
        "msg": "The proposal has not been approved by the multisig"
      },
      {
        "code": 6003,
        "name": "InvalidWormholeProgram",
        "msg": "Invalid Wormhole program ID"
      },
      {
        "code": 6004,
        "name": "FailedToSendMessage",
        "msg": "Failed to send Wormhole message"
      },
      {
        "code": 6005,
        "name": "TransactionIndexMismatch",
        "msg": "The transaction index does not match"
      },
      {
        "code": 6006,
        "name": "InvalidTargetChain",
        "msg": "Invalid target chain ID"
      },
      {
        "code": 6007,
        "name": "ProposalAlreadyExecuted",
        "msg": "Proposal already executed"
      },
      {
        "code": 6008,
        "name": "UnauthorizedAuthority",
        "msg": "Unauthorized authority"
      },
      {
        "code": 6009,
        "name": "InvalidTargetAddress",
        "msg": "Invalid target address format"
      },
      {
        "code": 6010,
        "name": "CallDataTooLarge",
        "msg": "Call data exceeds maximum size"
      },
      {
        "code": 6011,
        "name": "GasLimitTooHigh",
        "msg": "Gas limit too high"
      }
    ],
    "types": [
      {
        "name": "CrossChainProposal",
        "docs": [
          "Represents a cross-chain transaction proposal"
        ],
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "multisig",
              "docs": [
                "The Squads multisig PDA this proposal belongs to"
              ],
              "type": "pubkey"
            },
            {
              "name": "transaction_index",
              "docs": [
                "The Squads transaction index for verification"
              ],
              "type": "u64"
            },
            {
              "name": "target_chain",
              "docs": [
                "Target chain ID (Wormhole chain ID format)"
              ],
              "type": "u16"
            },
            {
              "name": "target_address",
              "docs": [
                "Target contract address on destination chain (32-byte format)"
              ],
              "type": {
                "array": [
                  "u8",
                  32
                ]
              }
            },
            {
              "name": "call_data",
              "docs": [
                "Serialized function call data"
              ],
              "type": "bytes"
            },
            {
              "name": "gas_limit",
              "docs": [
                "Gas limit for execution"
              ],
              "type": "u64"
            },
            {
              "name": "status",
              "docs": [
                "Status of this proposal"
              ],
              "type": {
                "defined": {
                  "name": "ProposalStatus"
                }
              }
            },
            {
              "name": "wormhole_sequence",
              "docs": [
                "Wormhole sequence number (if sent)"
              ],
              "type": {
                "option": "u64"
              }
            },
            {
              "name": "created_at",
              "docs": [
                "Timestamp when created"
              ],
              "type": "i64"
            },
            {
              "name": "executed_at",
              "docs": [
                "Timestamp when executed"
              ],
              "type": {
                "option": "i64"
              }
            },
            {
              "name": "bump",
              "docs": [
                "Bump seed for the proposal PDA"
              ],
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "MeridianConfig",
        "docs": [
          "The global configuration account for the Meridian program"
        ],
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "authority",
              "docs": [
                "The authority that can update program settings"
              ],
              "type": "pubkey"
            },
            {
              "name": "authorized_multisig",
              "docs": [
                "The authorized Squads multisig PDA"
              ],
              "type": "pubkey"
            },
            {
              "name": "wormhole_program",
              "docs": [
                "The Wormhole program ID"
              ],
              "type": "pubkey"
            },
            {
              "name": "wormhole_bridge",
              "docs": [
                "The Wormhole bridge PDA"
              ],
              "type": "pubkey"
            },
            {
              "name": "wormhole_fee_collector",
              "docs": [
                "The Wormhole fee collector"
              ],
              "type": "pubkey"
            },
            {
              "name": "emitter",
              "docs": [
                "The PDA that acts as the emitter for Wormhole messages"
              ],
              "type": "pubkey"
            },
            {
              "name": "emitter_bump",
              "docs": [
                "Bump seed for the emitter PDA"
              ],
              "type": "u8"
            },
            {
              "name": "sequence",
              "docs": [
                "Current sequence number for Wormhole messages"
              ],
              "type": "u64"
            },
            {
              "name": "bump",
              "docs": [
                "Bump seed for the config PDA"
              ],
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "ProposalStatus",
        "docs": [
          "Status of a cross-chain proposal"
        ],
        "type": {
          "kind": "enum",
          "variants": [
            {
              "name": "Pending"
            },
            {
              "name": "Executed"
            },
            {
              "name": "Failed"
            },
            {
              "name": "Cancelled"
            }
          ]
        }
      }
    ]
  } as const;