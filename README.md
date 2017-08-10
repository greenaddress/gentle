Warning: Gentle is deprecated - please use the [garecovery](https://github.com/greenaddress/garecovery) tool instead.

## What is Gentle?

Gentle is a tool that [GreenAddress](https://greenaddress.it) has developed for the peace of mind of its users: Its function is to free funds from your GreenAddress wallet without GreenAddress's intervention.

## What does this mean?

This means that should GreenAddress disappear for any reason, including out of their control, your funds are still available to you. See [FAQ](https://greenaddress.it/faq)

## How does it work?

The system will automatically provide you with the fund's private keys and transactions to send via any service such as Bitcoin-qt, Electrum or [Blockr.io](https://btc.blockr.io/tx/push)

The user is also able to check transactions details, export data in CSV format or directly push transactions via third-party services.

## Which browsers does Gentle support?

Firefox and Chrome/Chromium only at the moment but an app is in the works.

Note:

To use Gentle with Chrome/Chromium you need to open the browser with the --allow-file-access-from-files flag or serve the files from a local webserver.

If you have python installed you can get a simple web server by opening a shell, entering the gentle directory and run:

 `python -m SimpleHTTPServer 8080`

Once you have your webserver running open in your browser [http://localhost:8080](http://localhost:8080)
