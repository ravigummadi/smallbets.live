"""Services layer - Imperative Shell for SmallBets.live

This layer performs I/O operations and delegates business logic to the core.
Following FCIS pattern:
- Services handle Firestore operations
- Services delegate to game_logic.py for pure calculations
- No business logic in this layer
"""
