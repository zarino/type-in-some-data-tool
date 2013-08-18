function populateTable(){
  // Is there already a table?
  scraperwiki.sql.meta(function(meta){
    if('data' in meta.table){
      // Yes! There's a table. Make the header row.
      var $tr = $('<tr>').appendTo('thead')
      $tr.append('<th data-column="rowid">#</th>')
      var $tf = $('<tr>').appendTo('tfoot')
      $tf.append('<td data-column="rowid" class="new-row">+</td>')
      $tf.append('<td class="new-row" colspan="' + meta.table.data.columnNames.length + '"></td>')
      $tf.append('<td class="new-row"></td>')
      $.each(meta.table.data.columnNames, function(i, colName){
        $tr.append('<th data-column="' + colName + '">' + colName + '</th>')
      })
      $tr.append('<th class="new-column">+</th>')
      // Is there any data in that table?
      scraperwiki.sql('SELECT rowid, * FROM "data" ORDER BY "rowid"', function(data){
        if(data.length){
          // Yes! Append all the rows to the table.
          $.each(data, function(i, row){
            var $tr = $('<tr>').appendTo('tbody')
            $.each(row, function(cellName, cellValue){
              if(cellName == 'rowid'){
                var cellValue = ''
              }
              if(cellValue == null){
                var cellValue = ''
              }
              $tr.append('<td data-column="' + cellName + '" data-row="' + row['rowid'] + '">' + cellValue + '</td>')
            })
            $tr.append('<td class="new-column"></td>')
          })
          setStatus('loaded')
        }
      }, function(error){
        scraperwiki.alert('An unexpected error occurred', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
        setStatus('')
      })
    } else {
      // D'oh, no table yet!
      showTableSetup()
      setStatus('')
    }
  }, function(error){
    // D'oh, no database yet!
    setStatus('')
    if(error.responseText.indexOf("database file does not exist") !== -1){
      showTableSetup()
    } else {
      scraperwiki.alert('An unexpected error occurred', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    }
  })
}

function showTableSetup(){
  fresh = true
  console.log('create a starter table here')
}

function editCell(e){
  var $td = $(this)
  var originalValue = $td.text()
  var width = $td.outerWidth()
  var $input = $('<textarea>').text(originalValue).on('blur', function(e){
    // on blur, deleted entire row if it is empty, or save if not
    if($.trim($(this).val()) == '' && $.trim($(this).parents('tr').text()) == ''){
      $(this).parents('tr').remove()
    } else {
      saveCell.call(this, e)
    }
  }).on('keydown', function(e){
    // return key saves
    // escape key aborts
    // tab key moves to next cell (blurring and saving the current cell)
    // shift-tab moved to previous cell (blurrand and saving as above)
    if(e.which == 13){
      e.preventDefault()
      saveCell.call(this, e)
    } else if(e.which == 27){
      var originalValue = $(this).parent().attr('data-originalValue')
      if($(this).parents('tr').is('.new') && $.trim($(this).parents('tr').text()) == ''){
        $(this).parents('tr').remove()
      } else {
        $(this).parent().removeClass('editing').css('width', '').text(originalValue)
      }
    } else if(e.which == 9){
      e.preventDefault()
      if(e.shiftKey){
        if($(this).parent().prev(':visible').length){
          editCell.call($(this).parent().prev()[0], e)
        } else if($(this).parents('tr').prev().length){
          editCell.call($(this).parents('tr').prev().children('td:visible').eq(-1)[0], e)
        }
      } else {
        if($(this).parent().next().length){
          editCell.call($(this).parent().next()[0], e)
        } else if($(this).parents('tr').next().length){
          editCell.call($(this).parents('tr').next().children('td:visible').eq(0)[0], e)
        }
      }
    }
  })
  $td.addClass('editing').css('width', width).empty().attr('data-originalValue', originalValue)
  $input.appendTo($td).select()
}

function saveCell(e){
  var $td = $(this).parent()
  var columnToSave = $td.attr('data-column')
  var valueToSave = $(this).val()
  var originalValue = $td.attr('data-originalValue')
  if(valueToSave == originalValue){
    $td.removeClass('editing').css('width', '').text(originalValue)
    return true
  }
  setStatus('saving')
  var rowId = $td.attr('data-row')
  if(rowId){
    // we're updating a value in an existing record
    var sql = 'UPDATE "data" SET ' + sqlEscape(columnToSave, false) + ' = ' + sqlEscape(valueToSave, true) + ' WHERE rowid = ' + sqlEscape(rowId, true) + ';'
  } else {
    // this is a completely new row; generate an incremental rowid, or if this is the first row, start at 1
    var newRowId = parseInt($td.parent().prev().children('td:first-child').attr('data-row')) + 1 || 1
    var sql = 'INSERT INTO "data" (rowid, ' + sqlEscape(columnToSave, false) + ') VALUES (' + newRowId + ', ' + sqlEscape(valueToSave, true) + ');'
    $td.parent().children().attr('data-row', newRowId)
  }
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $td.removeClass('editing').css('width', '').text(valueToSave)
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      setStatus('saved')
    } else {
      $td.text( $td.attr('data-originalValue') )
      scraperwiki.alert('Could not save new cell value', 'SQL error: ' + output, 1)
      setStatus('')
    }
  }, function(error){
    $td.removeClass('saving').text( $td.attr('data-originalValue') )
    scraperwiki.alert('Could not save new cell value', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    setStatus('')
  })
}

function newColumn(){
  var $td = $('<th class="new editing">').insertBefore('thead .new-column')
  unhighlightColumn.call($td[0])
  var $input = $('<textarea>').appendTo($td).focus().on('blur', function(e){
    var columnName = $.trim($(this).val())
    if(columnName != ''){
      saveColumn.call(this, e)
    } else {
      $('thead .new-column, tbody .new-column').prev().remove()
      incrementFooterColspan(-1)
      if(fresh){ showTableSetup() }
    }
  }).on('keydown', function(e){
    // return key saves,
    // escape key aborts,
    // tab key saves
    var columnName = $.trim($(this).val())
    if(e.which == 13 && columnName != ''){
      e.preventDefault()
      saveColumn.call(this, e)
    } else if(e.which == 27){
      $('thead .new-column, tbody .new-column').prev().remove()
      incrementFooterColspan(-1)
      if(fresh){ showTableSetup() }
    } else if(e.which == 9 && columnName != ''){
      e.preventDefault()
      saveColumn.call(this, e)
    }
  })
  $('tbody tr').each(function(i){
    $(this).children('.new-column').before('<td data-row="' + (i+1) + '">')
  })
  incrementFooterColspan(1)
}

function saveColumn(e){
  setStatus('saving')
  var $th = $(this).parent()
  var columnName = $(this).val()
  if(fresh){
    var sql = 'CREATE TABLE IF NOT EXISTS "data" (' + sqlEscape(columnName, false) + ');'
  } else {
    var sql = 'ALTER TABLE "data" ADD COLUMN ' + sqlEscape(columnName, false) + ';'
  }
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $th.removeClass('new editing').text(columnName)
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      if(fresh){
        fresh = false
        $th.before('<th data-column="rowid"></th>')
      }
      setStatus('saved')
      $('thead .new-column, tbody .new-column').prev().attr('data-column', columnName)
    } else {
      $('thead .new-column, tbody .new-column').prev().remove()
      incrementFooterColspan(-1)
      if(fresh){ showTableSetup() }
      scraperwiki.alert('Could not create new column', 'SQL error: ' + output, 1)
      setStatus('')
    }
  }, function(error){
    $('thead .new-column, tbody .new-column').prev().remove()
    incrementFooterColspan(-1)
    if(fresh){ showTableSetup() }
    scraperwiki.alert('Could not create new column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    setStatus('')
  })
}

function newRow(){
  var $tr = $('<tr class="new">').appendTo('tbody')
  $('thead th').not('.new-column').each(function(){
    var columnName = $(this).text()
    // the first column should be called rowid, not #
    if(columnName == '#'){ columnName = 'rowid' }
    $tr.append('<td data-column="' + columnName + '">')
  })
  $tr.append('<td class="new-column">')
  // begin editing the first cell (skipping the rowid cell at .eq(0))
  editCell.call($tr.children().eq(1)[0])
}

function deleteRow(){
  setStatus('saving')
  var $tr = $(this).parent('tr').hide()
  var rowid = parseInt($(this).attr('data-row'))
  var sql = 'DELETE FROM "data" WHERE rowid=' + sqlEscape(rowid, true) + ' LIMIT 1;'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      $tr.remove()
      setStatus('saved')
    } else {
      $tr.show()
      scraperwiki.alert('Could not delete row', 'SQL error: ' + output, 1)
      setStatus('')
    }
  }, function(error){
    $tr.show()
    scraperwiki.alert('Could not delete row', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    setStatus('')
  })
}

function highlightColumn(e){
  var eq = $(this).index() + 1
  $('th:nth-child(' + eq + '), td:nth-child(' + eq + ')').addClass('highlighted')
}

function unhighlightColumn(e){
  var eq = $(this).index() + 1
  $('th:nth-child(' + eq + '), td:nth-child(' + eq + ')').removeClass('highlighted')
}

function renameColumn(e){
  // ignore clicks from any of the table header's children (eg: a.deleteColumn)
  if(e.target.tagName != 'TH'){ return false }

  var $th = $(this)
  unhighlightColumn.call($th[0])

  var originalName = $th.attr('data-column')
  var width = $th.outerWidth()
  $th.addClass('editing').css('width', width).empty()
  var $input = $('<textarea>').text(originalName).on('blur', function(e){
    var newName = $.trim($(this).val())
    if(newName == originalName || newName == ''){
      $(this).parent().removeClass('editing').css('width', '').text(originalName)
    } else {
      saveColumnName.call(this, e)
    }
  }).on('keydown', function(e){
    // return key saves
    // escape key aborts
    // tab key saves and moves to next cell
    if(e.which == 13){
      e.preventDefault()
      saveColumnName.call(this, e)
    } else if(e.which == 27){
      $(this).parent().removeClass('editing').css('width', '').text(originalName)
    } else if(e.which == 9){
      e.preventDefault()
      saveColumnName.call(this, e)
    }
  })
  $input.appendTo($th).select()
}

function saveColumnName(){
  var $th = $(this).parent()
  var newName = $(this).val()
  var originalName = $th.attr('data-column')

  var oldColumns = []
  var newColumns = []
  $('th:visible').not('[data-column="rowid"], .new-column').each(function(){
    var n = $(this).attr('data-column')
    oldColumns.push(sqlEscape(n, false))
    if(n == originalName){
      newColumns.push(sqlEscape(newName, false))
    } else {
      newColumns.push(sqlEscape(n, false))
    }
  })

  var sql = 'BEGIN TRANSACTION; CREATE TEMPORARY TABLE backup(' + oldColumns.join(', ') + '); INSERT INTO backup SELECT ' + oldColumns + ' FROM data; DROP TABLE data; CREATE TABLE data(' + newColumns.join(', ') + '); INSERT INTO data SELECT ' + oldColumns.join(', ') + ' FROM backup; DROP TABLE backup; COMMIT;'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $th.removeClass('editing').css('width', '').text(newName)
  setStatus('saving')
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      setStatus('saved')
      $('[data-column="' + originalName + '"]').attr('data-column', newName)
    } else {
      $th.removeClass('saving').css('width', '').text(originalName)
      scraperwiki.alert('Could not rename column', 'SQL error: ' + output, 1)
      setStatus('')
    }
  }, function(error){
    $th.removeClass('saving').css('width', '').text(originalName)
    scraperwiki.alert('Could not rename column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    setStatus('')
  })
}

function deleteColumn(){
  setStatus('saving')
  var $th = $(this).parent('th')
  var cols = []
  $('th:visible').not($th).not('[data-column="rowid"], .new-column').each(function(){
    cols.push($(this).text())
  })
  cols = '"' + cols.join('", "') + '"'
  var sql = 'BEGIN TRANSACTION; CREATE TEMPORARY TABLE backup(' + cols + '); INSERT INTO backup SELECT ' + cols + ' FROM data; DROP TABLE data; CREATE TABLE data(' + cols + '); INSERT INTO data SELECT ' + cols + ' FROM backup; DROP TABLE backup; COMMIT;'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      $column.remove()
      setStatus('saved')
    } else {
      $th.removeClass('deleting').children('a').remove()
      $column.removeClass('highlighted')
      scraperwiki.alert('Could not delete column', 'SQL error: ' + output, 1)
      setStatus('')
    }
  }, function(error){
    $th.removeClass('deleting').children('a').remove()
    $column.removeClass('highlighted')
    scraperwiki.alert('Could not delete column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    setStatus('')
  })
}

function incrementFooterColspan(increment){
  var $td = $('tfoot td:last-child').prev()
  $td.attr('colspan', parseInt($td.attr('colspan')) + increment)
}

function setStatus(status){
  if(!status){
    $('#status').fadeOut(function(){
      $(this).text('').show()
    })
    return true
  } else if(status=='loading'){
    var html = 'Loading&hellip;'
  } else if(status=='loaded'){
    var html = 'Loaded'
    setTimeout(function(){
      if($('#status').html()=='Loaded'){ setStatus('') }
    }, 2000)
  } else if(status=='saving'){
    var html = 'Saving&hellip;'
  } else if(status=='saved'){
    var html = 'Saved'
    setTimeout(function(){
      if($('#status').html()=='Saved'){ setStatus('') }
    }, 2000)
  }
  $('#status').stop().html(html).show()
  if(status=='loading' || status=='saving'){
    $('#status').addClass('working')
  } else {
    $('#status').removeClass('working')
  }
}

function sqlEscape(str, literal) {
  if(literal){
    quote = "'" // set literal to true for strings you're inserting into a table
    singleQuote = "''"
    doubleQuote = '"'
  } else {
    quote = '"' // set literal to false for column and table names
    singleQuote = "'"
    doubleQuote = '""'
  }
  if(str == '' || str == null){
    return 'NULL'
  } else if(isNaN(str)){
    str = str.replace(/[']/g, singleQuote)
    str = str.replace(/["]/g, doubleQuote)
    return quote + str + quote
  } else {
    return str
  }
}

var fresh = false

populateTable()

$(function(){
  $(document).on('click', '.new-row', newRow)
  $(document).on('click', '.new-column', newColumn)
  $(document).on('click', 'tbody td:first-child', deleteRow)
  $(document).on('click', 'td:not(.editing, .new-row, .new-column, :first-child)', editCell)
  $(document).on('click', 'th:not(.placeholder, .editing, .new-column, :first-child)', renameColumn)
  $(document).on('mouseenter', 'th, .new-column', highlightColumn)
  $(document).on('mouseleave', 'th, .new-column', unhighlightColumn)
});
