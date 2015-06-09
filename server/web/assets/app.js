/*
 * Copyright 2015 Haiku, Inc. All rights reserved.
 * Distributed under the terms of the MIT License.
 *
 * Authors:
 *		Augustin Cavalier <waddlesplash>
 */

var kArchitecture = ['x86', 'x86_64', 'x86_gcc2', 'arm', 'ppc'];
function getFriendlyNameForStatus(status) {
	if (status == 'pending')
		return 'queued';
	else if (status == 'running')
		return 'started';
	else
		return status;
}

/*! toggles the contents and spinner areas */
function hideContents() {
	$('#pageContents').hide();
	$('#loading-placeholder').show();
}
function showContents() {
	$('#loading-placeholder').hide();
	$('#pageContents').show();
}

/*! sets the page <title> and <div id='pageTitle'> */
function setPageTitle(title, description) {
	$('title').html(title + ' | Haiku Kitchen');
	$('#pageTitle h2').html(title);
	$('#pageTitle p').html(description);
}

function pageLoadingFailed() {
	setPageTitle('Ack!', 'Something went wrong! <i class="fa fa-frown-o"></i> Try reloading the page.');
	showContents();
}

function fetchPageAndCall(pageUrl, func) {
	$.ajax(pageUrl, {dataType: 'text'})
		.done(function (data) {
			func(data);
		})
		.fail(pageLoadingFailed);
}

function showHomePage(data) {
	setPageTitle('Home', '');
	$('#pageContentsBody').html(data);
	showContents();
}

function showRecipesPage(pageData) {
	$.ajax('/api/recipes')
		.done(function (data) {
			$('#pageContentsBody').html(pageData);

			for (var i in data) {
				var html =
					'<tr><td><i class="fa fa-file-text-o"></i> ' + data[i].name + '</td>' +
					'<td>' + data[i].category + '</td>' +
					'<td>' + data[i].version + '</td>' +
					'<td>' + data[i].revision + '</td><td>';
				if (data[i].lint === true)
					html += '<i class="fa fa-check-circle"></i>';
				else if (data[i].lint === false)
					html += '<i class="fa fa-times-circle"></i>';
				else
					html += '<i class="fa fa-question-circle"></i>';
				html += "</td>";
				for (var a in kArchitecture) {
					var arch = kArchitecture[a];
					html += "<td>";
					if (arch in data[i] && data[i][arch])
						html += '<a href="' + data[i][arch] + '"><i class="fa fa-archive"></i></a>';
					html += "</td>";
				}
				html += "</tr>";

				$("#recipesTableBody").append(html);
			}
			$("table.sortable").stupidtable();

			setPageTitle('Recipes', 'This is a complete listing of recipes known ' +
				'to the Haiku package build system:');
			showContents();
		})
		.fail(pageLoadingFailed);
}

function showBuildersPage() {
	$.ajax('/api/builders')
		.done(function (data) {
			var onlineBuilders = 0, totalBuilders = 0;
			for (var i in data) {
				totalBuilders++;
				var html =
					'<div class="builder"><span class="heading"> ' + i + ' ';
				if (data[i].status == 'online') {
					onlineBuilders++;
					html += '<i class="fa fa-check-circle-o"></i>';
				} else if (data[i].status == 'restarting')
					html += '<i class="fa fa-dot-circle-o" style="color: orange;"></i>';
				else
					html += '<i class="fa fa-times-circle-o"></i>';
				html += '</span>&nbsp;&nbsp;<span>owner: ' +
						data[i].owner.replace(/<[^>]*>/g, '') + '<br>';
				if (data[i].status === 'online') {
					html += '<a href="https://cgit.haiku-os.org/haiku/commit/?id=hrev' +
							data[i].hrev + '">hrev' + data[i].hrev + '</a>, ' +
						data[i].cores + (data[i].cores > 1 ? ' cores' : ' core') + ', ' +
						data[i].flavor + ' ' + data[i].architecture + '</div>';
				}
				$("#pageContentsBody").append(html);
			}
			setPageTitle('Builders', "<b>" + onlineBuilders +
				"</b> builders are online out of <b>" + totalBuilders + "</b>.");
			showContents();
		})
		.fail(pageLoadingFailed);
}

function showBuildsPage() {
	$.ajax('/api/builds')
		.done(function (data) {
			$("#pageContentsBody").html('<table id="buildsTable"></table>');
			for (var i in data) {
				var row = '<tr class="status-' + data[i].status + '">';
				row += '<td><a href="#/build/' + data[i].id + '">#' +
					data[i].id + '</a></td>';
				row += '<td>' + data[i].description + '</td>';
				row += '<td>' + getFriendlyNameForStatus(data[i].status) +
					' ' + $.timeago(data[i].lastTime) + '</td>';
				row += '<td>' + data[i].steps + ' steps</td>';
				row += '</tr>';
				$("#buildsTable").append(row);
			}
			setPageTitle('Builds', '');
			showContents();
		})
		.fail(pageLoadingFailed);
}

function showBuildPage(pageData) {
	$.ajax('/api/build/' + /[^/]*$/.exec(window.location.hash)[0])
		.done(function (data) {
			$('#pageContentsBody').html(pageData);

			$("#statusName").html(getFriendlyNameForStatus(data.status));
			$("#buildStatus").addClass('status-' + data.status);
			$("#lastTime").html($.timeago(data.lastTime));

			for (var i in data.steps) {
				var status;
				if (data.status == 'completed' || data.curStep > i)
					status = 'completed';
				else if (data.curStep == i) {
					if (data.status == 'failed')
						status = 'failed';
					else
						status = 'active';
				} else
					status = 'pending';
				var item = '<li class="status-' + status + '">';
				item += data.steps[i] + '</li>';
				$("#buildSteps").append(item);
			}

			setPageTitle('Build #' + data.id, data.description);
			showContents();
		})
		.fail(pageLoadingFailed);
}

var currentHash = '';
function navigate(force) {
	if (currentHash == window.location.hash && !force)
		return;

	hideContents();
	$('#menu li').removeClass('active');
	$('#pageContentsBody').html('');
	setPageTitle('Loading…', '');

	if (window.location.hash.indexOf("#/build/") == 0) {
		fetchPageAndCall('pages/build.html', showBuildPage);
		return;
	}
	switch (window.location.hash) {
	case '':
	case '#/':
		fetchPageAndCall('pages/home.html', showHomePage);
		break;
	case '#/recipes':
		$('#menu li.recipes').addClass('active');
		fetchPageAndCall('pages/recipes.html', showRecipesPage);
		break;
	case '#/builders':
		$('#menu li.builders').addClass('active');
		showBuildersPage();
		break;
	case '#/builds':
		$('#menu li.builds').addClass('active');
		showBuildsPage();
		break;

	default:
		setPageTitle('404 Not Found', 'We can’t find that page! <i class="fa fa-frown-o"></i>');
		showContents();
		break;
	}
	currentHash = window.location.hash;
}

$(window).on('hashchange', function() {
	navigate();
});
$(function () {
	$.timeago.settings.allowFuture = true;
	navigate(true);
});
