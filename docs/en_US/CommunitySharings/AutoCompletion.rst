Auto Completion for nnictl Commands
===================================

NNI's command line tool **nnictl** support auto-completion, i.e., you can complete a nnictl command by pressing the ``tab`` key.

For example, if the current command is

.. code-block:: bash

   nnictl cre

By pressing the ``tab`` key, it will be completed to

.. code-block:: bash

   nnictl create

For now, auto-completion will not be enabled by default if you install NNI through ``pip``\ , and it only works on Linux with bash shell. If you want to enable this feature on your computer, please refer to the following steps:

Step 1. Download ``bash-completion``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: bash

   cd ~
   wget https://raw.githubusercontent.com/microsoft/nni/{nni-version}/tools/bash-completion

Here, {nni-version} should by replaced by the version of NNI, e.g., ``master``, ``v2.1``. You can also check the latest ``bash-completion`` script :githublink:`here <tools/bash-completion>`.

.. cannot find :githublink:`here <tools/bash-completion>`.

Step 2. Install the script
^^^^^^^^^^^^^^^^^^^^^^^^^^

If you are running a root account and want to install this script for all the users

.. code-block:: bash

   install -m644 ~/bash-completion /usr/share/bash-completion/completions/nnictl

If you just want to install this script for your self

.. code-block:: bash

   mkdir -p ~/.bash_completion.d
   install -m644 ~/bash-completion ~/.bash_completion.d/nnictl
   echo '[[ -f ~/.bash_completion.d/nnictl ]] && source ~/.bash_completion.d/nnictl' >> ~/.bash_completion

Step 3. Reopen your terminal
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Reopen your terminal and you should be able to use the auto-completion feature. Enjoy!

Step 4. Uninstall
^^^^^^^^^^^^^^^^^

If you want to uninstall this feature, just revert the changes in the steps above.
