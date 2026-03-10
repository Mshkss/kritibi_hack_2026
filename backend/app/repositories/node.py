"""Repository placeholder for Node."""


class NodeRepository:
    def get(self, entity_id: str):
        raise NotImplementedError

    def list(self):
        raise NotImplementedError

    def create(self, payload: dict):
        raise NotImplementedError

    def update(self, entity_id: str, payload: dict):
        raise NotImplementedError

    def delete(self, entity_id: str):
        raise NotImplementedError
