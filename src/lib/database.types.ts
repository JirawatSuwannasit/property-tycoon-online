export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RoomStatus = "waiting" | "playing" | "finished";
export type PlayerStatus = "active" | "bankrupt" | "left";
export type TileType = "start" | "property" | "tax" | "chance" | "jail" | "go_to_jail" | "bonus";
export type ChanceCardType =
  | "receive_money"
  | "pay_money"
  | "move_to_start"
  | "move_steps"
  | "go_to_jail";

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          room_code: string;
          status: RoomStatus;
          max_players: number;
          host_player_id: string | null;
          current_turn_player_id: string | null;
          winner_player_id: string | null;
          turn_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          status?: RoomStatus;
          max_players?: number;
          host_player_id?: string | null;
          current_turn_player_id?: string | null;
          winner_player_id?: string | null;
          turn_number?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          status?: RoomStatus;
          max_players?: number;
          host_player_id?: string | null;
          current_turn_player_id?: string | null;
          winner_player_id?: string | null;
          turn_number?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          room_id: string;
          display_name: string;
          avatar_key: string;
          seat_no: number;
          is_host: boolean;
          is_ready: boolean;
          money: number;
          position: number;
          status: PlayerStatus;
          jail_turns: number;
          session_token_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          display_name: string;
          avatar_key: string;
          seat_no: number;
          is_host?: boolean;
          is_ready?: boolean;
          money?: number;
          position?: number;
          status?: PlayerStatus;
          jail_turns?: number;
          session_token_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          display_name?: string;
          avatar_key?: string;
          seat_no?: number;
          is_host?: boolean;
          is_ready?: boolean;
          money?: number;
          position?: number;
          status?: PlayerStatus;
          jail_turns?: number;
          session_token_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      game_tiles: {
        Row: {
          id: string;
          tile_index: number;
          type: TileType;
          name: string;
          description: string | null;
          price: number | null;
          rent: number | null;
          amount: number | null;
          color_group: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tile_index: number;
          type: TileType;
          name: string;
          description?: string | null;
          price?: number | null;
          rent?: number | null;
          amount?: number | null;
          color_group?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tile_index?: number;
          type?: TileType;
          name?: string;
          description?: string | null;
          price?: number | null;
          rent?: number | null;
          amount?: number | null;
          color_group?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          room_id: string;
          tile_id: string;
          owner_player_id: string;
          purchased_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          tile_id: string;
          owner_player_id: string;
          purchased_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          tile_id?: string;
          owner_player_id?: string;
          purchased_at?: string;
        };
        Relationships: [];
      };
      chance_cards: {
        Row: {
          id: string;
          card_key: string;
          type: ChanceCardType;
          title: string;
          description: string;
          amount: number | null;
          steps: number | null;
          target_tile_index: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_key: string;
          type: ChanceCardType;
          title: string;
          description: string;
          amount?: number | null;
          steps?: number | null;
          target_tile_index?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_key?: string;
          type?: ChanceCardType;
          title?: string;
          description?: string;
          amount?: number | null;
          steps?: number | null;
          target_tile_index?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      game_events: {
        Row: {
          id: string;
          room_id: string;
          player_id: string | null;
          event_type: string;
          message: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id?: string | null;
          event_type: string;
          message: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string | null;
          event_type?: string;
          message?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      game_snapshots: {
        Row: {
          id: string;
          room_id: string;
          state: Json;
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          state: Json;
          version?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          state?: Json;
          version?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
