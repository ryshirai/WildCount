import type { LobbyMock } from '@/types/game'

/** Waiting lobby mock — host can start, 6/10 joined */
export const mockLobby: LobbyMock = {
  roomCode: 'AB7KQ2',
  maxPlayers: 10,
  isHost: true,
  players: [
    {
      id: 'p1',
      name: 'あなた',
      avatar: '🐻',
      isHost: true,
      isSelf: true,
      isReady: true,
    },
    {
      id: 'p2',
      name: 'フクロウ',
      avatar: '🦉',
      isHost: false,
      isSelf: false,
      isReady: true,
    },
    {
      id: 'p3',
      name: 'キタロー',
      avatar: '🦊',
      isHost: false,
      isSelf: false,
      isReady: true,
    },
    {
      id: 'p4',
      name: 'オオカミ',
      avatar: '🐺',
      isHost: false,
      isSelf: false,
      isReady: false,
    },
    {
      id: 'p5',
      name: 'シカ',
      avatar: '🦌',
      isHost: false,
      isSelf: false,
      isReady: true,
    },
    {
      id: 'p6',
      name: 'ハヤブサ',
      avatar: '🦅',
      isHost: false,
      isSelf: false,
      isReady: true,
    },
  ],
}
