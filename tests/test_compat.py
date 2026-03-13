import importlib
import sys
import warnings

import opensky


def test_legacy_package_import_warns_and_exposes_version():
    sys.modules.pop("skyroute", None)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        legacy = importlib.import_module("skyroute")
    assert legacy.__version__ == opensky.__version__
    assert any("deprecated" in str(warning.message) for warning in caught)


def test_legacy_submodule_reexports_current_objects():
    from skyroute.safety import check_route as legacy_check_route
    from opensky.safety import check_route as current_check_route

    assert legacy_check_route is current_check_route
