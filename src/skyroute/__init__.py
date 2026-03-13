from __future__ import annotations

import warnings

warnings.warn("`skyroute` is deprecated; use `opensky` instead.", DeprecationWarning, stacklevel=2)

from opensky import *  # noqa: F401,F403
from opensky import __version__
