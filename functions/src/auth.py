import os
from firebase_functions import https_fn

# UID du propriétaire unique des données (app single-user). Source de vérité
# unique côté Cloud Functions ; override possible via la variable
# d'environnement OWNER_UID (déploiement / tests). Miroir de isOwner() dans
# firestore.rules.
OWNER_UID = os.environ.get("OWNER_UID", "o8XVO65fGtVwA1BnD9C8Nniu7MB3")


def require_owner(req: https_fn.CallableRequest) -> None:
    """Refuse l'accès à tout appelant autre que le propriétaire du compte.

    Lève UNAUTHENTICATED si non connecté, PERMISSION_DENIED si connecté avec un
    UID différent. À appeler en tête de chaque fonction on_call sensible.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Vous devez être connecté.",
        )
    if req.auth.uid != OWNER_UID:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Accès réservé au propriétaire du compte.",
        )
