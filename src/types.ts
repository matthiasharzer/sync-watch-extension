/** biome-ignore-all lint/suspicious/noExplicitAny: This file contains type definitions for messages and response handlers */

type PlayerAction = 'play' | 'pause' | 'seek';

type AnyMessage = any;
type SendResponse = (response: any) => void;

export type { AnyMessage, PlayerAction, SendResponse };
