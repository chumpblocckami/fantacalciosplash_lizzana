import logging


def init_logger(edition: int, name: str):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # create file handler which logs even debug messages
    fh = logging.FileHandler(f"assets/{edition}/{edition}_{name}.log")
    sh = logging.StreamHandler()
    fh.setLevel(logging.DEBUG)
    sh.setLevel(logging.DEBUG)

    logger.addHandler(fh)
    logger.addHandler(sh)

    return logger
