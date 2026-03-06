import json
import os

class LayoutManager:
    def __init__(self, filename="floor_plan_offline.json"):
        self.filename = filename

    def save_layout(self, grid, size):
        """Saves static map elements (Walls, Windows, Exits) to JSON."""
        layout_data = {
            "size": size,
            "walls": [],
            "windows": [],
            "exits": []
        }
        for pos, node in grid.items():
            if node.type == 'WALL':
                layout_data["walls"].append(pos)
            elif node.type == 'WINDOW':
                layout_data["windows"].append(pos)
            # Detect Exits specifically
            if (node.x == 0 or node.x == size-1 or node.y == 0 or node.y == size-1) and node.type == 'EMPTY':
                layout_data["exits"].append(pos)

        with open(self.filename, 'w') as f:
            json.dump(layout_data, f)

    def load_layout(self):
        """Returns: size, walls_set, windows_set, exits_set (or None)"""
        if not os.path.exists(self.filename):
            return None

        with open(self.filename, 'r') as f:
            data = json.load(f)
        
        walls = set(tuple(x) for x in data["walls"])
        windows = set(tuple(x) for x in data["windows"])
        exits = set(tuple(x) for x in data["exits"])
        return data["size"], walls, windows, exits