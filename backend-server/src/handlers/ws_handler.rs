use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    response::IntoResponse,
};
use tokio::sync::broadcast;
use tracing::{info, warn};

use crate::models::{
    message::{ClientMessage, ServerMessage, SystemEvent},
    room::{PeerInfo, RoomEvent},
};
use crate::repositories::room_repo::RoomRepository;
use crate::state::SharedState;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: SharedState) {
    let mut current_room: Option<String> = None;
    let mut current_peer_id: Option<String> = None;
    let mut room_rx: Option<broadcast::Receiver<RoomEvent>> = None;

    let mut system_rx = state.system_tx.subscribe();

    info!("🔌 New WebSocket connection");

    loop {
        tokio::select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(msg)) => {
                        match msg {
                            Message::Text(text) => {
                                if text.len() < 200 {
                                    info!("📨 Received: {}", text);
                                } else {
                                    info!("📨 Received (len={}): {}...", text.len(), &text[0..50]);
                                }

                                match serde_json::from_str::<ClientMessage>(&text) {
                                    Ok(client_msg) => {
                                        match handle_client_message(
                                            &mut socket,
                                            &state,
                                            &client_msg,
                                            &mut current_room,
                                            &mut current_peer_id,
                                            &mut room_rx,
                                        )
                                        .await
                                        {
                                            Ok(should_close) => {
                                                if should_close {
                                                    break;
                                                }
                                            }
                                            Err(e) => {
                                                warn!("Error handling message: {}", e);
                                                let error_msg = ServerMessage::Error {
                                                    message: e.to_string(),
                                                };
                                                let _ = socket
                                                    .send(Message::Text(
                                                        serde_json::to_string(&error_msg).unwrap(),
                                                    ))
                                                    .await;
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        warn!("❌ Invalid message format: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            message: format!("Invalid message format: {}", e),
                                        };
                                        let _ = socket
                                            .send(Message::Text(
                                                serde_json::to_string(&error_msg).unwrap(),
                                            ))
                                            .await;
                                    }
                                }
                            }
                            Message::Close(_) => {
                                info!("🔌 Client closed connection");
                                break;
                            }
                            _ => {}
                        }
                    }
                    Some(Err(e)) => {
                        warn!("WebSocket error: {}", e);
                        break;
                    }
                    None => {
                        info!("🔌 WebSocket stream ended");
                        break;
                    }
                }
            }

            event = async {
                if let Some(ref mut rx) = room_rx {
                    rx.recv().await
                } else {
                    futures::future::pending().await
                }
            } => {
                if let Ok(event) = event {
                    if let Err(e) = forward_room_event(&mut socket, event, current_peer_id.as_ref()).await {
                        warn!("Failed to forward room event: {}", e);
                    }
                }
            }

            sys_msg = system_rx.recv() => {
                match sys_msg {
                    Ok(SystemEvent::Shutdown) => {
                        info!("🛑 Server shutting down, closing connection for peer: {:?}", current_peer_id);
                        let _ = socket.send(Message::Close(None)).await;
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    if let (Some(room_code), Some(peer_id)) = (current_room, current_peer_id) {
        leave_room(&state, &room_code, &peer_id).await;
    }
}

async fn forward_room_event(
    socket: &mut WebSocket,
    event: RoomEvent,
    current_peer_id: Option<&String>,
) -> Result<(), String> {
    let server_msg = match event {
        RoomEvent::PeerJoined { peer } => Some(ServerMessage::PeerJoined { peer }),
        RoomEvent::PeerLeft { peer_id } => Some(ServerMessage::PeerLeft { peer_id }),
        RoomEvent::DataSync { from, data } => {
            if Some(&from) == current_peer_id {
                None
            } else {
                Some(ServerMessage::Data { from, data })
            }
        }
        RoomEvent::DocumentUpdate { from, document } => {
            if Some(&from) == current_peer_id {
                None
            } else {
                info!("📄 Document update from {}, broadcasting to peers", from);
                Some(ServerMessage::DocumentSync { document })
            }
        }
        RoomEvent::HostChanged { new_host_id } => {
            info!("👑 Host changed to: {}", new_host_id);
            None
        }
    };

    if let Some(msg) = server_msg {
        let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
        socket.send(Message::Text(json)).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn handle_client_message(
    socket: &mut WebSocket,
    state: &SharedState,
    msg: &ClientMessage,
    current_room: &mut Option<String>,
    current_peer_id: &mut Option<String>,
    room_rx: &mut Option<broadcast::Receiver<RoomEvent>>,
) -> Result<bool, String> {
    match msg {
        ClientMessage::Join {
            room_code,
            peer_id,
            is_host,
            metadata,
        } => {
            if let Err(e) = crate::services::room_service::ensure_room_exists(state, room_code).await {
                return Err(e);
            }

            if let Some(mut room) = state.rooms.get_mut(room_code) {
                if room.empty_since.is_some() {
                    room.empty_since = None;
                    info!("🔄 Room revived: {}", room_code);
                }

                *room_rx = Some(room.tx.subscribe());

                let peer_info = PeerInfo {
                    id: peer_id.clone(),
                    joined_at: chrono::Utc::now(),
                    is_host: *is_host,
                    metadata: metadata.clone(),
                };

                room.peers.insert(peer_id.clone(), peer_info.clone());

                let event = RoomEvent::PeerJoined { peer: peer_info };
                let _ = room.tx.send(event);

                let peers: Vec<PeerInfo> = room
                    .peers
                    .iter()
                    .map(|entry| entry.value().clone())
                    .collect();

                let response = ServerMessage::RoomInfo {
                    room_code: room_code.clone(),
                    host_id: room.host_id.clone(),
                    peers,
                };
                socket
                    .send(Message::Text(
                        serde_json::to_string(&response).unwrap(),
                    ))
                    .await
                    .map_err(|e| e.to_string())?;

                let connected = ServerMessage::Connected {
                    peer_id: peer_id.clone(),
                    room_code: room_code.clone(),
                };
                socket
                    .send(Message::Text(
                        serde_json::to_string(&connected).unwrap(),
                    ))
                    .await
                    .map_err(|e| e.to_string())?;

                *current_room = Some(room_code.clone());
                *current_peer_id = Some(peer_id.clone());

                info!(
                    "👤 Peer joined: {} in room {} (host: {})",
                    current_peer_id.as_ref().unwrap(),
                    current_room.as_ref().unwrap(),
                    is_host
                );

                if let Some(doc) = &room.document_state {
                    let sync = ServerMessage::DocumentSync {
                        document: doc.clone(),
                    };
                    socket
                        .send(Message::Text(serde_json::to_string(&sync).unwrap()))
                        .await
                        .map_err(|e| e.to_string())?;
                }

                Ok(false)
            } else {
                Err("Room not found".to_string())
            }
        }

        ClientMessage::Leave => {
            *room_rx = None;
            if let (Some(room_code), Some(peer_id)) = (current_room.take(), current_peer_id.take()) {
                leave_room(state, &room_code, &peer_id).await;
                return Ok(true);
            }
            Ok(false)
        }

        ClientMessage::Broadcast { data } => {
            if let (Some(room_code), Some(peer_id)) = (current_room.as_ref(), current_peer_id.as_ref()) {
                if let Some(room) = state.rooms.get(room_code) {
                    let event = RoomEvent::DataSync {
                        from: peer_id.clone(),
                        data: data.clone(),
                    };
                    let _ = room.tx.send(event);
                }
            }
            Ok(false)
        }

        ClientMessage::SyncDocument { document } => {
            if let (Some(room_code), Some(peer_id)) = (current_room.as_ref(), current_peer_id.as_ref()) {
                if let Some(mut room) = state.rooms.get_mut(room_code) {
                    room.document_state = Some(document.clone());
                    room.last_sync = chrono::Utc::now();

                    let event = RoomEvent::DocumentUpdate {
                        from: peer_id.clone(),
                        document: document.clone(),
                    };
                    let _ = room.tx.send(event);

                    let room_repo = RoomRepository::new(&state.db);
                    let room_code_clone = room_code.clone();
                    let document_clone = document.clone();
                    tokio::spawn(async move {
                        let _ = room_repo.upsert_document(&room_code_clone, &document_clone).await;
                    });

                    info!("📄 Document synced by {} in room {}", peer_id, room_code);
                }
            }
            Ok(false)
        }

        ClientMessage::RequestSync => {
            if let Some(room_code) = current_room.as_ref() {
                if let Some(room) = state.rooms.get(room_code) {
                    if let Some(doc) = &room.document_state {
                        let sync = ServerMessage::DocumentSync {
                            document: doc.clone(),
                        };
                        socket
                            .send(Message::Text(serde_json::to_string(&sync).unwrap()))
                            .await
                            .map_err(|e| e.to_string())?;
                        info!("📄 Sent document to peer upon request in room {}", room_code);
                    } else {
                        let sync = ServerMessage::DocumentSync {
                            document: String::new(),
                        };
                        socket
                            .send(Message::Text(serde_json::to_string(&sync).unwrap()))
                            .await
                            .map_err(|e| e.to_string())?;
                        info!("📄 Sent empty document (no data yet) in room {}", room_code);
                    }
                }
            }
            Ok(false)
        }

        ClientMessage::Ping => {
            let pong = ServerMessage::Pong;
            socket
                .send(Message::Text(serde_json::to_string(&pong).unwrap()))
                .await
                .map_err(|e| e.to_string())?;
            Ok(false)
        }
    }
}

async fn leave_room(state: &SharedState, room_code: &str, peer_id: &str) {
    if let Some(mut room) = state.rooms.get_mut(room_code) {
        room.peers.remove(peer_id);

        let event = RoomEvent::PeerLeft {
            peer_id: peer_id.to_string(),
        };
        let _ = room.tx.send(event);

        info!("👤 Peer left: {} from room {}", peer_id, room_code);

        if room.peers.is_empty() {
            room.empty_since = Some(chrono::Utc::now());
            if state.room_idle_timeout_seconds == 0 {
                info!("🕒 Room {} is empty; keeping indefinitely", room_code);
            } else {
                info!(
                    "🕒 Room {} is empty; keeping for {}s before cleanup",
                    room_code, state.room_idle_timeout_seconds
                );
            }
        }
    }
}
