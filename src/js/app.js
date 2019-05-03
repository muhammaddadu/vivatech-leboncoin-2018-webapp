import '../scss/_import.scss';
import angular from 'angular';

const BoxContractRaw = require('./smartcontracts/Box.compiled.json');
const BoxContractInterface = JSON.parse(BoxContractRaw.interface);
const BoxContract = web3.eth.contract(BoxContractInterface);
const BoxContractBytecode = '0x' + BoxContractRaw.bytecode;

const currentAccount = web3.eth.accounts[0];

const app = angular.module('application', []);

app.factory('ProductModel', ['$http', function ($http) {
    return {
        create: function create(data) {
            return $http({
                method: 'PUT',
                url: '/api/v1/user/' + address,
                data: data
            });
        }
    }
}]);

app.factory('BranchModel', ['$http', function ($http) {
    return {
        createTrustUrl: function createTrustUrl(contractAddress) {
            return $http({
                method: 'POST',
                url: 'https://api.branch.io/v1/url',
                data: {
                    "branch_key": "key_live_lfvIpVeI9TFWxPCqwU8rZnogFqhnzs4D",
                    "event": "openURL",
                    "~campaign": "trust-ios-browser-sharing",
                    "~channel": "trust-ios-browser-sharing",
                    "url": "https://muhammaddadu.github.io/vivatech-leboncoin-2018-webapp/product.html?address=" + contractAddress,
                    "$canonical_url": "https://muhammaddadu.github.io/vivatech-leboncoin-2018-webapp/product.html?address=" + contractAddress
                }
            })
                .then((response) => response.data.url)
        }
    }
}]);

app.controller('addProduct', ['$scope', 'ProductModel', '$q', function ($scope, ProductModel, $q) {
    let currentUrl = new URL(window.location.href);
    let boxContractAddress = currentUrl.searchParams.get("address");
    let boxContract = BoxContract.at(boxContractAddress);

    $scope.ctrl = {
        isLoading: false,
        error: false,
        info: false,
        form: {}
    };

    $scope.resetForm = function () {
        $scope.ctrl.form = {
            name: 'Baseball Cap',
            price: '5.00',
            description: 'Big Beutifull Cap'
        };
    };

    function getContractData() {
        return $q((resolve, reject) => {
            let contractFields = ['owner', 'pricePerDay', 'lat', 'long', 'productContract', 'getStatus'];
            let responsesWanted = contractFields.length;
            let _data = {};

            contractFields.forEach((key) => {
                boxContract[key]((err, value) => {
                    if (err) {
                        console.error(err);
                    }

                    _data[key] = value;

                    responsesWanted--;
                    if (responsesWanted === 0) {
                        resolve(JSON.parse(JSON.stringify(_data)));
                    }
                });
            });
        });
    }

    getContractData().then((contractData) => {
        $scope.ctrl.box = contractData;

        if (contractData.getStatus === '1') {
            return window.location.href = './product.html?address=' + boxContractAddress;
        }

        $scope.ctrl.loading = false;
    });

    $scope.resetForm();

    $scope.ctrl.submitForm = function () {
        $scope.ctrl.isLoading = true;
        $scope.ctrl.error = false;
        $scope.ctrl.info = false;
        $scope.ctrl.itemAdded = false;

        $q((resolve, reject) => {
            const transactionObject = {
                from: currentAccount,
                gas: 100000,
                gasPrice: 100000
            };

            $scope.ctrl.loading = true;
            $scope.ctrl.error = false;
            $scope.ctrl.info = false;

            boxContract.setStatus.sendTransaction('1', transactionObject, (err, result) => {
                if (err) {
                    $scope.ctrl.error = err;
                    $scope.ctrl.isLoading = false;
                    return reject();
                }

                resolve();
            });
        })
        .then((contractInfo) => {
                $scope.ctrl.info = 'Item is now available to collect';
                $scope.ctrl.isLoading = false;
                $scope.ctrl.itemAdded = true;
        })
        .catch((err) => {
            $scope.ctrl.error = err;
            $scope.ctrl.isLoading = false;
            $scope.resetForm();
        });
    };
}]);

app.controller('addBox', ['$scope', 'BranchModel', '$interval', '$q', function ($scope, BranchModel, $interval, $q) {
    $scope.ctrl = {
        isLoading: false,
        error: false,
        info: false,
        form: {}
    };

    $scope.resetForm = function () {
        $scope.ctrl.form = {
            pricePerDay: '5',
            lat: '48.8307', // times it by 10,000 when going into contract
            long: '2.2870', // times it by 10,000 when going into contract
            dimensions: '4 x 4 inches',
        };
    };

    // BranchModel.createTrustUrl('0x705c2631c442982ec69444d0e85a03c771bf7983')
    //     .then((url) => {
    //         $scope.ctrl.qrcode = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + url;
    //     });

    $scope.resetForm();

    $scope.ctrl.submitForm = function () {
        $scope.ctrl.isLoading = true;
        $scope.ctrl.error = false;
        $scope.ctrl.info = false;
        $scope.ctrl.qrcode = false;

        $q((resolve, reject) => {
            web3.eth.estimateGas({ data: BoxContractBytecode }, (err, gasEstimate) => {
                if (err) { return reject(err); }
                resolve(gasEstimate);
            });
        })
            .then((gasEstimate) => {
                return $q((resolve, reject) => {
                    let newContractMetadata = {
                        from: currentAccount,
                        data: BoxContractBytecode,
                        gas: gasEstimate * 2,
                        gasPrice: 30000000000
                    };
                    BoxContract.new(
                        parseInt($scope.ctrl.form.pricePerDay, 10),
                        $scope.ctrl.form.lat * 10000,
                        $scope.ctrl.form.long * 10000,
                        $scope.ctrl.form.dimensions,
                        newContractMetadata,
                        (err, contractInfo) => {
                            if (err) { reject(err) }
                            if (contractInfo.address) {
                                return resolve({ contractAddress: contractInfo.address });
                            }

                            let interval;

                            function getAddress() {
                                web3.eth.getTransactionReceipt(contractInfo.transactionHash, (err, info) => {
                                    if (!info || !info.contractAddress) { return; }

                                    clearInterval(interval);
                                    return resolve(info);
                                });
                            }

                            interval = $interval(getAddress, 2000);
                        });
                });
            })
            .then((contractInfo) => {
                BranchModel.createTrustUrl(contractInfo.contractAddress)
                    .then((url) => {
                        console.log(url);
                        $scope.ctrl.info = 'contract created at ' + contractInfo.contractAddress;
                        console.log($scope.ctrl.info);
                        $scope.ctrl.isLoading = false;
                        $scope.ctrl.qrcode = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + url;
                        $scope.resetForm();
                    });
            })
            .catch((err) => {
                $scope.ctrl.error = err;
                $scope.ctrl.isLoading = false;
                $scope.resetForm();
            });
    };
}]);

app.controller('ProductController', ['$scope', 'ProductModel', '$q', function ($scope, ProductModel, $q) {
    let currentUrl = new URL(window.location.href);
    let boxContractAddress = currentUrl.searchParams.get("address");
    let boxContract = BoxContract.at(boxContractAddress);

    $scope.ctrl = {
        loading: true,
        product: {
            image: 'https://ae01.alicdn.com/kf/HTB10XQlpQCWBuNjy0Faq6xUlXXan/EFINNY-Hommes-Femmes-Plaine-Casquette-de-baseball-Unisexe-Courbe-Visor-Chapeau-Hip-Hop-R-glable-A.jpg_640x640.jpg',
            name: 'Baseball Cap',
            price: '5.00',
            description: 'Big Beutifull Cap'
        }
    };

    function getContractData() {
        return $q((resolve, reject) => {
            let contractFields = ['owner', 'pricePerDay', 'lat', 'long', 'productContract', 'getStatus'];
            let responsesWanted = contractFields.length;
            let _data = {};

            contractFields.forEach((key) => {
                boxContract[key]((err, value) => {
                    if (err) {
                        console.error(err);
                    }

                    _data[key] = value;

                    responsesWanted--;
                    if (responsesWanted === 0) {
                        resolve(JSON.parse(JSON.stringify(_data)));
                    }
                });
            });
        });
    }

    getContractData().then((contractData) => {
        $scope.ctrl.box = contractData;

        if (contractData.getStatus === '0') {
            return window.location.href = './addProduct.html?address=' + boxContractAddress;
        }

        $scope.ctrl.loading = false;
    });

    $scope.ctrl.purchase = function () {
        const transactionObject = {
            from: currentAccount,
            gas: 100000,
            gasPrice: 100000
        };

        $scope.ctrl.loading = true;
        $scope.ctrl.error = false;
        $scope.ctrl.info = false;

        boxContract.release.sendTransaction(transactionObject, (err, result) => {
            if (err) {
                $scope.ctrl.error = err;
                $scope.ctrl.isLoading = false;
                return;
            }

            $scope.ctrl.isLoading = false;
            $scope.ctrl.info = 'You may take you item out of the box!';
        });
    };
}]);


app.controller('PurchaseController', ['$scope', 'ProductModel', function ($scope, ProductModel) {
    const scanner = new Instascan.Scanner({ video: document.getElementById('preview') });

    scanner.addListener('scan', function (content) {
        console.log(content);
    });

    Instascan.Camera.getCameras()
        .then(function (cameras) {
            if (cameras.length > 0) {
                scanner.start(cameras[0]);
            } else {
                console.error('No cameras found.');
            }
        })
        .catch(function (e) {
            console.error(e);
        });

        setTimeout(() => {
            let video = document.getElementById('preview');
            video.setAttribute("playsinline", true);
            video.setAttribute("controls", true);
            setTimeout(() => {
                video.removeAttribute("controls");
            });
        });
}]);
